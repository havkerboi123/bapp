import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: NextRequest) {
  const partnerWallet = req.nextUrl.searchParams.get("partnerWallet");

  if (!partnerWallet) {
    return NextResponse.json(
      { error: "partnerWallet is required" },
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

  // Get all pending loans for this partner
  const { data, error } = await supabase
    .from("loans")
    .select(
      `
      id,
      amount,
      description,
      loan_date,
      expected_return_date,
      created_at,
      status,
      owner:users!loans_owner_user_id_fkey (
        name,
        username,
        store_name
      )
    `,
    )
    .eq("partner_user_id", partner.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Error fetching pending loans" },
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
      createdAt: row.created_at as string,
      status: row.status as string,
      ownerName: row.owner.name as string,
      ownerUsername: row.owner.username as string,
      ownerStoreName: row.owner.store_name as string,
    })) ?? [];

  return NextResponse.json({ loans });
}
