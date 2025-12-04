import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Get loan details for payment
 * Partner calls this to get the loan information needed to pay
 */
export async function GET(req: NextRequest) {
  try {
    const loanId = req.nextUrl.searchParams.get("loanId");
    const partnerWallet = req.nextUrl.searchParams.get("partnerWallet");

    if (!loanId || !partnerWallet) {
      return NextResponse.json(
        { error: "loanId and partnerWallet required" },
        { status: 400 },
      );
    }

    // Normalize wallet address
    const normalizedWallet = partnerWallet.toLowerCase().startsWith("0x")
      ? partnerWallet.toLowerCase()
      : `0x${partnerWallet.toLowerCase()}`;

    // Find partner user
    const { data: partner, error: partnerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: "Partner user not found" },
        { status: 404 },
      );
    }

    // Get the loan
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select(
        `
        *,
        owner:users!loans_owner_user_id_fkey (
          name,
          username,
          wallet_address
        ),
        partner:users!loans_partner_user_id_fkey (
          name,
          username,
          wallet_address
        )
      `,
      )
      .eq("id", loanId)
      .eq("partner_user_id", partner.id)
      .eq("status", "waiting on payment")
      .maybeSingle();

    if (loanError || !loan) {
      return NextResponse.json(
        { error: "Loan not found or not ready for payment" },
        { status: 404 },
      );
    }

    // Verify loan has on-chain loan ID
    if (!loan.onchain_loan_id) {
      return NextResponse.json(
        { error: "Loan has not been recorded on-chain yet" },
        { status: 400 },
      );
    }

    // Return loan data needed for payment
    return NextResponse.json({
      loan: {
        id: loan.id,
        onchainLoanId: loan.onchain_loan_id,
        amount: loan.amount,
        ownerWallet: loan.owner_wallet_address || loan.owner.wallet_address,
        partnerWallet: loan.partner_wallet_address || loan.partner.wallet_address,
        description: loan.description || "",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Update loan after payment is confirmed
 * Called after partner successfully pays the loan on-chain
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      loanId?: string;
      partnerWallet?: string;
      txHash?: string; // Transaction hash of the payment
    };

    if (!body.loanId || !body.partnerWallet || !body.txHash) {
      return NextResponse.json(
        { error: "loanId, partnerWallet, and txHash required" },
        { status: 400 },
      );
    }

    // Normalize wallet address
    const normalizedWallet = body.partnerWallet.toLowerCase().startsWith("0x")
      ? body.partnerWallet.toLowerCase()
      : `0x${body.partnerWallet.toLowerCase()}`;

    // Find partner user
    const { data: partner, error: partnerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: "Partner user not found" },
        { status: 404 },
      );
    }

    // Get the loan and verify it belongs to this partner
    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .select("*")
      .eq("id", body.loanId)
      .eq("partner_user_id", partner.id)
      .eq("status", "waiting on payment")
      .maybeSingle();

    if (loanError || !loan) {
      return NextResponse.json(
        { error: "Loan not found or not in waiting on payment status" },
        { status: 404 },
      );
    }

    // Print payment details to terminal
    console.log("=".repeat(60));
    console.log("💰 PAYMENT RECEIVED");
    console.log("=".repeat(60));
    console.log("Loan ID:", body.loanId);
    console.log("Payment sent FROM (Partner):", body.partnerWallet);
    console.log("Payment sent TO (Owner):", loan.owner_wallet_address);
    console.log("Amount:", loan.amount, "PKR");
    console.log("Transaction Hash:", body.txHash);
    console.log("=".repeat(60));

    // Update loan to paid back
    const { data: updateData, error: updateError } = await supabase
      .from("loans")
      .update({
        status: "paid back",
        paid_back_date: new Date().toISOString(),
        // Optionally store payment tx hash in a separate column if needed
        // For now, we'll just update status and date
      })
      .eq("id", body.loanId)
      .select()
      .single();

    if (updateError || !updateData) {
      return NextResponse.json(
        { error: "Error updating loan status" },
        { status: 500 },
      );
    }

    console.log("✅ Loan status updated to 'paid back'");
    console.log("=".repeat(60));

    // Mint achievement NFT for the partner
    let nftMintResult = null;
    try {
      if (loan.onchain_loan_id) {
        // Convert PKR amount to wei (same conversion as frontend)
        const PKR_TO_ETH_RATE = parseFloat(
          process.env.NEXT_PUBLIC_PKR_TO_ETH_RATE || "0.000003",
        );
        const ethAmount = loan.amount * PKR_TO_ETH_RATE;
        const weiAmount = BigInt(Math.floor(ethAmount * 1e18));

        // Call NFT minting endpoint
        const mintResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/nft/mint`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              recipientAddress: normalizedWallet,
              loanId: loan.onchain_loan_id,
              amount: weiAmount.toString(),
            }),
          },
        );

        if (mintResponse.ok) {
          nftMintResult = await mintResponse.json();
          console.log("🎉 Achievement NFT minted successfully!");
          console.log("NFT Token ID:", nftMintResult.tokenId);
        } else {
          const errorData = await mintResponse.json();
          console.error("⚠️ Failed to mint NFT:", errorData.error);
          // Don't fail the payment if NFT minting fails
        }
      }
    } catch (nftError: any) {
      console.error("⚠️ Error minting NFT:", nftError.message);
      // Don't fail the payment if NFT minting fails
    }

    return NextResponse.json({
      success: true,
      loan: updateData,
      nft: nftMintResult
        ? {
            tokenId: nftMintResult.tokenId,
            transactionHash: nftMintResult.transactionHash,
            message: "Achievement NFT minted!",
          }
        : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

