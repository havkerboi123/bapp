#!/usr/bin/env tsx
/**
 * Script to update the NFT contract's base URI to point to your Vercel deployment
 * 
 * Usage:
 *   npx tsx scripts/update-nft-uri.ts <your-vercel-url>
 * 
 * Example:
 *   npx tsx scripts/update-nft-uri.ts https://your-app.vercel.app
 */

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { readFileSync } from "fs";
import { join } from "path";

// Load environment variables from .env.local if it exists
try {
  const envPath = join(process.cwd(), ".env.local");
  const envFile = readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env.local doesn't exist or can't be read, that's okay
}

// Get values from environment or command line
const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

const VERCEL_URL = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL;

if (!VERCEL_URL) {
  console.error("❌ Error: Vercel URL is required!");
  console.log("\nUsage:");
  console.log("  npx tsx scripts/update-nft-uri.ts <vercel-url>");
  console.log("\nOr set NEXT_PUBLIC_APP_URL environment variable");
  process.exit(1);
}

const OWNER_PRIVATE_KEY = process.env.NFT_MINTER_PRIVATE_KEY;

if (!OWNER_PRIVATE_KEY) {
  console.error("❌ Error: NFT_MINTER_PRIVATE_KEY environment variable is required!");
  console.log("\nThis should be the private key of the wallet that owns the NFT contract.");
  process.exit(1);
}

if (NFT_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
  console.error("❌ Error: NEXT_PUBLIC_NFT_CONTRACT_ADDRESS is not set!");
  process.exit(1);
}

// Construct the new base URI
const NEW_BASE_URI = `${VERCEL_URL.replace(/\/$/, "")}/api/nft/metadata`;

const NFT_CONTRACT_ABI = parseAbi([
  "function setBaseTokenURI(string memory newBaseTokenURI) external",
  "function baseTokenURI() external view returns (string)",
]);

async function updateBaseURI() {
  try {
    console.log("🔧 Updating NFT Contract Base URI...\n");
    console.log(`Contract Address: ${NFT_CONTRACT_ADDRESS}`);
    console.log(`New Base URI: ${NEW_BASE_URI}\n`);

    // Create account from private key
    const account = privateKeyToAccount(OWNER_PRIVATE_KEY as `0x${string}`);
    console.log(`Using wallet: ${account.address}\n`);

    // Create public client for reading
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    });

    // Create wallet client for writing
    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http("https://sepolia.base.org"),
    });
    const currentURI = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "baseTokenURI",
    });

    console.log(`Current Base URI: ${currentURI}`);
    console.log(`New Base URI: ${NEW_BASE_URI}\n`);

    if (currentURI === NEW_BASE_URI) {
      console.log("✅ Base URI is already set to this value. No update needed!");
      return;
    }

    // Update base URI
    console.log("📝 Sending transaction...");
    const hash = await client.writeContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "setBaseTokenURI",
      args: [NEW_BASE_URI],
    });

    console.log("\n✅ Transaction sent!");
    console.log(`Transaction Hash: ${hash}`);
    console.log(`View on BaseScan: https://sepolia.basescan.org/tx/${hash}\n`);

    console.log("⏳ Waiting for confirmation...");
    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}\n`);

    // Verify the update
    const updatedURI = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "baseTokenURI",
    });

    console.log("✅ Base URI updated successfully!");
    console.log(`New Base URI: ${updatedURI}\n`);

    console.log("🎉 All done! Your NFT metadata will now be served from:");
    console.log(`   ${updatedURI}/<tokenId>\n`);
  } catch (error) {
    console.error("\n❌ Error updating base URI:", error);
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

updateBaseURI();

