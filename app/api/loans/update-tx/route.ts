import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Update loan with transaction hash and on-chain loan ID after on-chain recording
 * Changes status to "waiting on payment"
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      loanId?: string;
      txHash?: string;
      onchainLoanId?: string; // bytes32 loan ID from the contract
    };

    if (!body.loanId || !body.txHash) {
      return NextResponse.json(
        { error: "loanId and txHash required" },
        { status: 400 },
      );
    }

    const updateData: any = {
      tx_hash: body.txHash,
      status: "waiting on payment", // Change status after recording on-chain
    };

    // Store on-chain loan ID if provided
    if (body.onchainLoanId) {
      updateData.onchain_loan_id = body.onchainLoanId;
    }

    // Note: contract_address column may not exist in all databases
    // Only add it if the migration has been run
    // const contractAddress = process.env.NEXT_PUBLIC_LOAN_LEDGER_CONTRACT;
    // if (contractAddress) {
    //   updateData.contract_address = contractAddress;
    // }

    const { data, error } = await supabase
      .from("loans")
      .update(updateData)
      .eq("id", body.loanId)
      .eq("status", "accepted") // Only update accepted loans
      .select()
      .single();

    if (error) {
      console.error("Error updating loan with tx hash:", error);
      return NextResponse.json(
        { error: "Error updating loan with tx hash", details: error.message },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Loan not found or not in accepted status" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, loan: data });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

