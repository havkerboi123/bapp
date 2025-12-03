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

    // Get owner and partner wallet addresses
    const { data: ownerData } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", owner.id)
      .single();
    
    const { data: partnerData } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", partnerRow.partner_user_id)
      .single();

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
        owner_wallet_address: ownerData?.wallet_address || null,
        partner_wallet_address: partnerData?.wallet_address || null,
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
  const partnerWallet = req.nextUrl.searchParams.get("partnerWallet");

  if (!ownerWallet && !partnerWallet) {
    return NextResponse.json(
      { error: "ownerWallet or partnerWallet is required" },
      { status: 400 },
    );
  }

  // Fetch loans given (where user is owner)
  let loansGiven: any[] = [];
  let totalLoanGiven = 0;

  if (ownerWallet) {
    const normalizedWallet = ownerWallet.toLowerCase().startsWith("0x")
      ? ownerWallet.toLowerCase()
      : `0x${ownerWallet.toLowerCase()}`;

    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (!ownerError && owner) {
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

      if (!error && data) {
        loansGiven = data.map((row: any) => ({
          id: row.id as string,
          amount: row.amount as number,
          description: (row.description as string | null) ?? null,
          loanDate: (row.loan_date as string | null) ?? null,
          expectedReturnDate: (row.expected_return_date as string | null) ?? null,
          txHash: (row.tx_hash as string | null) ?? null,
          status: (row.status as string) || "pending",
          partnerName: row.partner?.name as string,
          partnerUsername: row.partner?.username as string,
          partnerWallet: row.partner?.wallet_address as string | undefined,
          loanType: "given" as const,
        }));

        totalLoanGiven = loansGiven
          .filter((loan) => loan.status === "accepted")
          .reduce((sum, loan) => sum + loan.amount, 0);
      }
    }
  }

  // Fetch loans taken (where user is partner)
  let loansTaken: any[] = [];
  let totalLoanTaken = 0;

  if (partnerWallet) {
    const normalizedWallet = partnerWallet.toLowerCase().startsWith("0x")
      ? partnerWallet.toLowerCase()
      : `0x${partnerWallet.toLowerCase()}`;

    const { data: partner, error: partnerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (!partnerError && partner) {
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
          onchain_loan_id,
          owner_wallet_address,
          partner_wallet_address,
          owner_user_id
        `,
        )
        .eq("partner_user_id", partner.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Fetch owner details separately
        const ownerIds = [...new Set(data.map((row: any) => row.owner_user_id).filter(Boolean))];
        const ownerMap = new Map();
        
        if (ownerIds.length > 0) {
          const { data: owners } = await supabase
            .from("users")
            .select("id, name, username, wallet_address")
            .in("id", ownerIds);
          
          if (owners) {
            owners.forEach((owner: any) => {
              ownerMap.set(owner.id, owner);
            });
          }
        }

        loansTaken = data.map((row: any) => {
          const ownerData = ownerMap.get(row.owner_user_id) || null;
          return {
            id: row.id as string,
            amount: row.amount as number,
            description: (row.description as string | null) ?? null,
            loanDate: (row.loan_date as string | null) ?? null,
            expectedReturnDate: (row.expected_return_date as string | null) ?? null,
            txHash: (row.tx_hash as string | null) ?? null,
            status: (row.status as string) || "pending",
            ownerName: ownerData?.name as string | undefined,
            ownerUsername: ownerData?.username as string | undefined,
            ownerWallet: ownerData?.wallet_address as string | undefined,
            onchainLoanId: row.onchain_loan_id as string | null,
            loanType: "taken" as const,
          };
        });

        totalLoanTaken = loansTaken
          .filter((loan) => loan.status === "accepted" || loan.status === "waiting on payment")
          .reduce((sum, loan) => sum + loan.amount, 0);
      }
    }
  }

  // Combine both lists
  const allLoans = [...loansGiven, ...loansTaken];

  return NextResponse.json({
    loans: allLoans,
    loansGiven,
    loansTaken,
    totalLoan: totalLoanGiven,
    totalLoanGiven,
    totalLoanTaken,
  });
}




