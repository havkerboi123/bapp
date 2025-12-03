import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      storeName?: string;
      username?: string;
      email?: string;
      walletAddress?: string;
    };

    if (
      !body.name ||
      !body.storeName ||
      !body.username ||
      !body.email ||
      !body.walletAddress
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Normalize for case-insensitive check
    const normalizedWallet = body.walletAddress.toLowerCase().startsWith("0x")
      ? body.walletAddress.toLowerCase()
      : `0x${body.walletAddress.toLowerCase()}`;

    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("*")
      .ilike("wallet_address", normalizedWallet)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        { error: "Error checking existing user" },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "User already exists for this wallet" },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        name: body.name,
        store_name: body.storeName,
        username: body.username,
        email: body.email,
        wallet_address: normalizedWallet,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Error creating user" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Simple lookup to check if a user exists for a given wallet
export async function GET(req: NextRequest) {
  const walletAddress = req.nextUrl.searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress is required" },
      { status: 400 },
    );
  }

  // Normalize wallet address for case-insensitive lookup
  const normalizedWallet = walletAddress.toLowerCase().startsWith("0x")
    ? walletAddress.toLowerCase()
    : `0x${walletAddress.toLowerCase()}`;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("wallet_address", normalizedWallet)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Error fetching user" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ user: data });
}



