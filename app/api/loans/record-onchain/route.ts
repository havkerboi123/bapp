import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * This endpoint is called after partner accepts a loan.
 * It prepares the loan data for on-chain recording.
 * The owner will need to sign the transaction (client-side) to record on-chain.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      loanId?: string;
      ownerWallet?: string;
    };

    if (!body.loanId || !body.ownerWallet) {
      return NextResponse.json(
        { error: "loanId and ownerWallet required" },
        { status: 400 },
      );
    }

    // Normalize wallet address
    const normalizedWallet = body.ownerWallet.toLowerCase().startsWith("0x")
      ? body.ownerWallet.toLowerCase()
      : `0x${body.ownerWallet.toLowerCase()}`;

    // Find owner user
    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: "Owner user not found" },
        { status: 404 },
      );
    }

    // Get the accepted loan
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
      .eq("id", body.loanId)
      .eq("owner_user_id", owner.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (loanError || !loan) {
      return NextResponse.json(
        { error: "Loan not found or not accepted" },
        { status: 404 },
      );
    }

    // Return loan data needed for on-chain recording
    return NextResponse.json({
      loan: {
        id: loan.id,
        ownerWallet: loan.owner.wallet_address,
        partnerWallet: loan.partner.wallet_address,
        amount: loan.amount,
        description: loan.description || "",
        loanDate: loan.loan_date
          ? Math.floor(new Date(loan.loan_date).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
        expectedReturnDate: loan.expected_return_date
          ? Math.floor(new Date(loan.expected_return_date).getTime() / 1000)
          : 0,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

