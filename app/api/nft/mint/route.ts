import { NextRequest, NextResponse } from "next/server";
import { mintNFT } from "@/lib/mintNFT";

/**
 * Mint an achievement NFT for a loan repayment
 * This endpoint can be called via HTTP (for external use) but internally uses the shared mintNFT function
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      recipientAddress?: string;
      loanId?: string; // bytes32 loan ID as hex string
      amount?: string; // Amount in wei as string
    };

    if (!body.recipientAddress || !body.loanId || !body.amount) {
      return NextResponse.json(
        { error: "recipientAddress, loanId, and amount required" },
        { status: 400 },
      );
    }

    // Use the shared minting function
    const result = await mintNFT({
      recipientAddress: body.recipientAddress,
      loanId: body.loanId,
      amount: body.amount,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        tokenId: result.tokenId,
        transactionHash: result.transactionHash,
        message: result.message,
        alreadyMinted: result.alreadyMinted || false,
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    console.error("Error minting NFT:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

