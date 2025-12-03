import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      ownerWallet?: string;
      partnerUsername?: string;
    };

    if (!body.ownerWallet || !body.partnerUsername) {
      return NextResponse.json(
        { error: "ownerWallet and partnerUsername required" },
        { status: 400 },
      );
    }

    // Normalize wallet address: ensure lowercase and 0x prefix
    const normalizedWallet = body.ownerWallet.toLowerCase().startsWith("0x")
      ? body.ownerWallet.toLowerCase()
      : `0x${body.ownerWallet.toLowerCase()}`;
    const partnerUsername = body.partnerUsername.trim().toLowerCase();

    // Use ilike for case-insensitive exact match
    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (ownerError || !owner) {
      return NextResponse.json(
        { error: "Owner user not found for this wallet" },
        { status: 404 },
      );
    }

    const { data: partner, error: partnerError } = await supabase
      .from("users")
      .select("*")
      .ilike("username", partnerUsername.trim())
      .maybeSingle();

    if (partnerError) {
      return NextResponse.json(
        { error: `Database error: ${partnerError.message}` },
        { status: 500 },
      );
    }

    if (!partner) {
      return NextResponse.json(
        { error: `Is username "${partnerUsername}" se koi user nahi mila. Pehle signup karein.` },
        { status: 404 },
      );
    }

    if (partner.id === owner.id) {
      return NextResponse.json(
        { error: "Apne aap ko partner list mein add nahi kar sakte." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("partners")
      .select("*")
      .eq("owner_user_id", owner.id)
      .eq("partner_user_id", partner.id)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Error checking existing partner" },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "Yeh partner already aap ke list mein hai." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("partners")
      .insert({
        owner_user_id: owner.id,
        partner_user_id: partner.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Partner add karne mein masla aya." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      partner: {
        id: data.id,
        username: partner.username,
        name: partner.name,
      },
    });
  } catch (error) {
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
    .from("partners")
    .select(
      `
        id,
        partner_user:users!partners_partner_user_id_fkey (
          username,
          name,
          wallet_address
        )
      `,
    )
    .eq("owner_user_id", owner.id);

  if (error) {
    return NextResponse.json(
      { error: "Error fetching partners" },
      { status: 500 },
    );
  }

  const partners =
    data?.map((row: any) => ({
      id: row.id as string,
      username: row.partner_user.username as string,
      name: row.partner_user.name as string,
      walletAddress: row.partner_user.wallet_address as string,
    })) ?? [];

  return NextResponse.json({
    partners,
    partnerCount: partners.length,
  });
}




