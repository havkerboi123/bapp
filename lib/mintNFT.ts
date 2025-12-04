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

export interface MintNFTParams {
  recipientAddress: string;
  loanId: string; // bytes32 loan ID as hex string
  amount: string; // Amount in wei as string
}

export interface MintNFTResult {
  success: true;
  tokenId: string;
  transactionHash: string;
  message: string;
  alreadyMinted?: boolean;
}

export interface MintNFTError {
  success: false;
  error: string;
}

/**
 * Mint an achievement NFT for a loan repayment
 * This function can be called directly from other server-side code
 */
export async function mintNFT(
  params: MintNFTParams,
): Promise<MintNFTResult | MintNFTError> {
  try {
    // Check if NFT contract is configured
    if (
      !NFT_CONTRACT_ADDRESS ||
      NFT_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
    ) {
      return {
        success: false,
        error:
          "NFT contract not configured. Please set NEXT_PUBLIC_NFT_CONTRACT_ADDRESS",
      };
    }

    if (!params.recipientAddress || !params.loanId || !params.amount) {
      return {
        success: false,
        error: "recipientAddress, loanId, and amount required",
      };
    }

    // Check if NFT already exists for this loan
    const loanIdBytes32 = params.loanId.startsWith("0x")
      ? (params.loanId as `0x${string}`)
      : (`0x${params.loanId}` as `0x${string}`);

    const hasNFT = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "hasAchievement",
      args: [loanIdBytes32],
    });

    if (hasNFT) {
      // Get existing token ID
      const tokenId = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: NFT_CONTRACT_ABI,
        functionName: "getTokenIdForLoan",
        args: [loanIdBytes32],
      });

      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: "",
        message: "NFT already minted for this loan",
        alreadyMinted: true,
      };
    }

    // For server-side minting, we need a wallet with the owner private key
    let ownerPrivateKey = process.env.NFT_MINTER_PRIVATE_KEY;

    if (!ownerPrivateKey) {
      return {
        success: false,
        error:
          "NFT_MINTER_PRIVATE_KEY not configured. Cannot mint NFTs server-side.",
      };
    }

    // Normalize private key: trim whitespace and ensure it starts with 0x
    ownerPrivateKey = ownerPrivateKey.trim();
    if (!ownerPrivateKey.startsWith("0x")) {
      ownerPrivateKey = `0x${ownerPrivateKey}`;
    }

    // Validate private key format (should be 66 characters: 0x + 64 hex chars)
    if (ownerPrivateKey.length !== 66) {
      return {
        success: false,
        error:
          "Invalid private key format. Private key must be 64 hex characters (with or without 0x prefix).",
      };
    }

    // Create account from private key
    let account;
    try {
      account = privateKeyToAccount(ownerPrivateKey as `0x${string}`);
    } catch (keyError: unknown) {
      const errorMessage =
        keyError instanceof Error ? keyError.message : "Unknown error";
      console.error("Invalid private key:", errorMessage);
      return {
        success: false,
        error: `Invalid private key: ${errorMessage}. Please check your NFT_MINTER_PRIVATE_KEY`,
      };
    }

    // Create wallet client for signing transactions
    const walletClient = createWalletClient({
      chain: baseSepolia,
      transport: http(),
      account,
    });

    // Convert amount to bigint
    const amountWei = BigInt(params.amount);

    // Normalize recipient address
    const recipientAddress = params.recipientAddress.toLowerCase().startsWith("0x")
      ? (params.recipientAddress.toLowerCase() as `0x${string}`)
      : (`0x${params.recipientAddress.toLowerCase()}` as `0x${string}`);

    // Mint the NFT
    const hash = await walletClient.writeContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "mintAchievement",
      args: [recipientAddress, loanIdBytes32, amountWei],
    });

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      // Get the token ID
      const tokenId = await publicClient.readContract({
        address: NFT_CONTRACT_ADDRESS as `0x${string}`,
        abi: NFT_CONTRACT_ABI,
        functionName: "getTokenIdForLoan",
        args: [loanIdBytes32],
      });

      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: receipt.transactionHash,
        message: "Achievement NFT minted successfully!",
      };
    } else {
      return {
        success: false,
        error: "Transaction failed",
      };
    }
  } catch (error: unknown) {
    console.error("Error minting NFT:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

