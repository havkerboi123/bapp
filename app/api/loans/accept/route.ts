import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      loanId?: string;
      partnerWallet?: string;
      action?: "accept" | "reject";
    };

    if (!body.loanId || !body.partnerWallet || !body.action) {
      return NextResponse.json(
        { error: "loanId, partnerWallet, and action (accept/reject) required" },
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
      .maybeSingle();

    if (loanError || !loan) {
      console.error("Loan fetch error:", loanError, "loanId:", body.loanId);
      return NextResponse.json(
        { error: "Loan not found" },
        { status: 404 },
      );
    }

    // Verify the loan belongs to this partner
    if (loan.partner_user_id !== partner.id) {
      console.error("Partner mismatch:", {
        loanPartnerId: loan.partner_user_id,
        currentPartnerId: partner.id,
        loanId: body.loanId,
      });
      return NextResponse.json(
        { error: "You don't have permission to update this loan" },
        { status: 403 },
      );
    }

    // Check if already accepted/rejected
    const currentStatus = (loan.status as string) || "pending";
    if (currentStatus === "accepted" || currentStatus === "rejected") {
      return NextResponse.json(
        { error: `Loan already ${currentStatus}` },
        { status: 400 },
      );
    }

    // Get owner wallet address
    const { data: ownerWalletData } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", loan.owner_user_id)
      .single();

    // Get partner wallet address
    const { data: partnerWalletData } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", loan.partner_user_id)
      .single();

    // Update loan status
    const newStatus = body.action === "accept" ? "accepted" : "rejected";
    
    // Update the loan - update by ID only since we've already verified permissions
    const updatePayload: any = { status: newStatus };
    
    // Update wallet addresses if they're not already set
    if (ownerWalletData?.wallet_address) {
      updatePayload.owner_wallet_address = ownerWalletData.wallet_address;
    }
    if (partnerWalletData?.wallet_address) {
      updatePayload.partner_wallet_address = partnerWalletData.wallet_address;
    }
    
    const { data: updateData, error: updateError } = await supabase
      .from("loans")
      .update(updatePayload)
      .eq("id", body.loanId)
      .select("*");

    if (updateError) {
      console.error("Update error:", updateError, {
        loanId: body.loanId,
        partnerId: partner.id,
        loanPartnerId: loan.partner_user_id,
        newStatus,
      });
      return NextResponse.json(
        { error: "Error updating loan status", details: updateError?.message },
        { status: 500 },
      );
    }

    // Check if any rows were updated
    if (!updateData || updateData.length === 0) {
      console.error("No rows updated:", {
        loanId: body.loanId,
        partnerId: partner.id,
        loanPartnerId: loan.partner_user_id,
        loanStatus: loan.status,
      });
      return NextResponse.json(
        { error: "Loan update failed - no rows updated. Please check if you have permission." },
        { status: 500 },
      );
    }

    // Verify the updated loan still belongs to this partner (safety check)
    const updatedLoan = updateData[0];
    if (updatedLoan.partner_user_id !== partner.id) {
      console.error("Security check failed - loan partner mismatch after update");
      // Rollback would be ideal, but for now just return error
      return NextResponse.json(
        { error: "Security check failed" },
        { status: 500 },
      );
    }

    console.log("Loan status updated successfully:", { loanId: body.loanId, newStatus, updatedStatus: updatedLoan.status });

    // Get owner details separately
    const { data: ownerData, error: ownerError } = await supabase
      .from("users")
      .select("name, username, wallet_address")
      .eq("id", updatedLoan.owner_user_id)
      .maybeSingle();

    if (ownerError || !ownerData) {
      console.error("Owner fetch error:", ownerError);
      // Still return success if loan was updated, but without owner details
      return NextResponse.json({
        success: true,
        loan: {
          id: updatedLoan.id,
          status: updatedLoan.status,
          amount: updatedLoan.amount,
          description: updatedLoan.description,
        },
        needsOnChainRecording: newStatus === "accepted",
      });
    }

    // If accepted, return owner wallet so frontend can trigger on-chain recording
    return NextResponse.json({
      success: true,
      loan: {
        id: updatedLoan.id,
        status: updatedLoan.status,
        amount: updatedLoan.amount,
        description: updatedLoan.description,
        ownerName: ownerData.name,
        ownerUsername: ownerData.username,
        ownerWallet: ownerData.wallet_address,
      },
      // If accepted, we need owner to sign on-chain transaction
      needsOnChainRecording: newStatus === "accepted",
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
