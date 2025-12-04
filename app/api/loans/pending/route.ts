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

  // Get all pending loans for this partner (for acceptance)
  const { data: pendingData, error: pendingError } = await supabase
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
      owner_user_id,
      owner_wallet_address,
      partner_wallet_address
    `,
    )
    .eq("partner_user_id", partner.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // Get all loans waiting on payment for this partner
  const { data: paymentData, error: paymentError } = await supabase
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
      onchain_loan_id,
      owner_wallet_address,
      partner_wallet_address,
      owner_user_id
    `,
    )
    .eq("partner_user_id", partner.id)
    .eq("status", "waiting on payment")
    .order("created_at", { ascending: false });

  if (pendingError) {
    console.error("Error fetching pending loans:", pendingError);
    return NextResponse.json(
      { error: "Error fetching pending loans", details: pendingError.message },
      { status: 500 },
    );
  }

  if (paymentError) {
    console.error("Error fetching payment loans:", paymentError);
    return NextResponse.json(
      { error: "Error fetching payment loans", details: paymentError.message },
      { status: 500 },
    );
  }

  const data = [...(pendingData || []), ...(paymentData || [])];

  // Fetch owner details for all unique owner IDs
  const ownerIds = [...new Set(data?.map((row: Record<string, unknown>) => row.owner_user_id).filter(Boolean) || [])];
  const ownerMap = new Map<string, Record<string, unknown>>();
  
  if (ownerIds.length > 0) {
    const { data: owners, error: ownersError } = await supabase
      .from("users")
      .select("id, name, username, store_name")
      .in("id", ownerIds);
    
    if (!ownersError && owners) {
      owners.forEach((owner: Record<string, unknown>) => {
        ownerMap.set(owner.id as string, owner);
      });
    }
  }

  const loans =
    data?.map((row: Record<string, unknown>) => {
      const ownerData = ownerMap.get(row.owner_user_id as string) || null;
      return {
        id: row.id as string,
        amount: row.amount as number,
        description: (row.description as string | null) ?? null,
        loanDate: (row.loan_date as string | null) ?? null,
        expectedReturnDate: (row.expected_return_date as string | null) ?? null,
        createdAt: row.created_at as string,
        status: row.status as string,
        ownerName: ownerData?.name as string | undefined,
        ownerUsername: ownerData?.username as string | undefined,
        ownerStoreName: ownerData?.store_name as string | undefined,
        onchainLoanId: row.onchain_loan_id as string | null,
        contractAddress: null, // contract_address column may not exist in all databases
        ownerWallet: row.owner_wallet_address as string | null,
        partnerWallet: row.partner_wallet_address as string | null,
      };
    }) ?? [];

  return NextResponse.json({ loans });
}
