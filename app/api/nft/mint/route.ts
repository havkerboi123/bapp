import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

const NFT_CONTRACT_ABI = parseAbi([
  "function mintAchievement(address recipient, bytes32 loanId, uint256 amount) external returns (uint256)",
  "function hasAchievement(bytes32 loanId) external view returns (bool)",
  "function getTokenIdForLoan(bytes32 loanId) external view returns (uint256)",
]);

// Create public client for reading
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

/**
 * Mint an achievement NFT for a loan repayment
 * This endpoint should be called server-side with a private key
 */
export async function POST(req: NextRequest) {
  try {
    // Check if NFT contract is configured
    if (
      !NFT_CONTRACT_ADDRESS ||
      NFT_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
    ) {
      return NextResponse.json(
        {
          error:
            "NFT contract not configured. Please set NEXT_PUBLIC_NFT_CONTRACT_ADDRESS in .env.local",
        },
        { status: 500 },
      );
    }

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

    // Check if NFT already exists for this loan
    const hasNFT = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "hasAchievement",
      args: [body.loanId as `0x${string}`],
    });

    if (hasNFT) {
      // Get existing token ID
      const tokenId = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: NFT_CONTRACT_ABI,
        functionName: "getTokenIdForLoan",
        args: [body.loanId as `0x${string}`],
      });

      return NextResponse.json({
        success: true,
        alreadyMinted: true,
        tokenId: tokenId.toString(),
        message: "NFT already minted for this loan",
      });
    }

    // For server-side minting, we need a wallet with the owner private key
    // This should be stored securely in environment variables
    let ownerPrivateKey = process.env.NFT_MINTER_PRIVATE_KEY;

    if (!ownerPrivateKey) {
      return NextResponse.json(
        {
          error:
            "NFT_MINTER_PRIVATE_KEY not configured. Cannot mint NFTs server-side.",
        },
        { status: 500 },
      );
    }

    // Normalize private key: trim whitespace and ensure it starts with 0x
    ownerPrivateKey = ownerPrivateKey.trim();
    if (!ownerPrivateKey.startsWith("0x")) {
      ownerPrivateKey = `0x${ownerPrivateKey}`;
    }

    // Validate private key format (should be 66 characters: 0x + 64 hex chars)
    if (ownerPrivateKey.length !== 66) {
      return NextResponse.json(
        {
          error:
            "Invalid private key format. Private key must be 64 hex characters (with or without 0x prefix).",
        },
        { status: 500 },
      );
    }

    // Create account from private key
    let account;
    try {
      account = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
    } catch (keyError: any) {
      console.error("Invalid private key:", keyError);
      return NextResponse.json(
        {
          error: `Invalid private key: ${keyError.message}. Please check your NFT_MINTER_PRIVATE_KEY in .env.local`,
        },
        { status: 500 },
      );
    }

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      chain: baseSepolia,
      transport: http(),
      account,
    });

    // Convert loanId to bytes32
    const loanIdBytes32 = body.loanId.startsWith("0x")
      ? (body.loanId as `0x${string}`)
      : (`0x${body.loanId}` as `0x${string}`);

    // Convert amount to bigint
    const amountWei = BigInt(body.amount);

    // Mint the NFT
    const hash = await walletClient.writeContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "mintAchievement",
      args: [
        body.recipientAddress as `0x${string}`,
        loanIdBytes32,
        amountWei,
      ],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      // Parse the event to get token ID
      // The mintAchievement function returns the tokenId, but we need to parse it from logs
      // For now, we'll query it
      const tokenId = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: NFT_CONTRACT_ABI,
        functionName: "getTokenIdForLoan",
        args: [loanIdBytes32],
      });

      return NextResponse.json({
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: receipt.transactionHash,
        message: "Achievement NFT minted successfully!",
      });
    } else {
      return NextResponse.json(
        { error: "Transaction failed" },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Error minting NFT:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

