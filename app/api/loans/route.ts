import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      ownerWallet?: string;
      partnerId?: string;
      amount?: number;
      description?: string | null;
      loanDate?: string | null;
      expectedReturnDate?: string | null;
      txHash?: string | null;
    };

    if (!body.ownerWallet || !body.partnerId || !body.amount) {
      return NextResponse.json(
        { error: "ownerWallet, partnerId and amount required" },
        { status: 400 },
      );
    }

    // Normalize wallet address
    const normalizedWallet = body.ownerWallet.toLowerCase().startsWith("0x")
      ? body.ownerWallet.toLowerCase()
      : `0x${body.ownerWallet.toLowerCase()}`;

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

    const { data: partnerRow, error: partnerError } = await supabase
      .from("partners")
      .select("*")
      .eq("id", body.partnerId)
      .eq("owner_user_id", owner.id)
      .maybeSingle();

    if (partnerError || !partnerRow) {
      return NextResponse.json(
        { error: "Partner not found for this owner" },
        { status: 404 },
      );
    }

    const { data: loanRow, error } = await supabase
      .from("loans")
      .insert({
        owner_user_id: owner.id,
        partner_user_id: partnerRow.partner_user_id,
        amount: body.amount,
        description: body.description,
        loan_date: body.loanDate,
        expected_return_date: body.expectedReturnDate,
        tx_hash: null, // Will be set when partner accepts
        status: "pending", // Start as pending, partner must accept
      })
      .select(
        `
        id,
        amount,
        description,
        loan_date,
        expected_return_date,
        tx_hash,
        status,
        partner:users!loans_partner_user_id_fkey (
          name,
          username
        )
      `,
      )
      .single();

    if (error || !loanRow) {
      return NextResponse.json(
        { error: "Error creating loan" },
        { status: 500 },
      );
    }

    const loan = {
      id: loanRow.id as string,
      amount: loanRow.amount as number,
      description: (loanRow.description as string | null) ?? null,
      loanDate: (loanRow.loan_date as string | null) ?? null,
      expectedReturnDate: (loanRow.expected_return_date as string | null) ?? null,
      txHash: (loanRow.tx_hash as string | null) ?? null,
      status: (loanRow.status as string) || "pending",
      partnerName: loanRow.partner.name as string,
      partnerUsername: loanRow.partner.username as string,
    };

    return NextResponse.json({ loan });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const ownerWallet = req.nextUrl.searchParams.get("ownerWallet");

  if (!ownerWallet) {
    return NextResponse.json(
      { error: "ownerWallet is required" },
      { status: 400 },
    );
  }

  // Normalize wallet address
  const normalizedWallet = ownerWallet.toLowerCase().startsWith("0x")
    ? ownerWallet.toLowerCase()
    : `0x${ownerWallet.toLowerCase()}`;

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

  const { data, error } = await supabase
    .from("loans")
      .select(
      `
        id,
        amount,
        description,
        loan_date,
        expected_return_date,
        tx_hash,
        status,
        partner:users!loans_partner_user_id_fkey (
          name,
          username,
          wallet_address
        )
      `,
    )
    .eq("owner_user_id", owner.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Error fetching loans" },
      { status: 500 },
    );
  }

  const loans =
    data?.map((row: any) => ({
      id: row.id as string,
      amount: row.amount as number,
      description: (row.description as string | null) ?? null,
      loanDate: (row.loan_date as string | null) ?? null,
      expectedReturnDate: (row.expected_return_date as string | null) ?? null,
      txHash: (row.tx_hash as string | null) ?? null,
      status: (row.status as string) || "pending", // Default to pending, not accepted
      partnerName: row.partner.name as string,
      partnerUsername: row.partner.username as string,
      partnerWallet: row.partner.wallet_address as string | undefined,
    })) ?? [];

  // Only count accepted loans in total
  const totalLoan = loans
    .filter((loan) => loan.status === "accepted")
    .reduce((sum, loan) => sum + loan.amount, 0);

  return NextResponse.json({
    loans,
    totalLoan,
  });
}




