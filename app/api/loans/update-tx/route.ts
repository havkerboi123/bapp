import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

/**
 * Update loan with transaction hash after on-chain recording
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      loanId?: string;
      txHash?: string;
    };

    if (!body.loanId || !body.txHash) {
      return NextResponse.json(
        { error: "loanId and txHash required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("loans")
      .update({ tx_hash: body.txHash })
      .eq("id", body.loanId)
      .eq("status", "accepted") // Only update accepted loans
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Error updating loan with tx hash" },
        { status: 500 },
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

