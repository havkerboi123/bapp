#!/usr/bin/env tsx
/**
 * Quick script to verify the NFT contract's base URI
 */

import { createPublicClient, http, parseAbi } from "viem";
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
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (error) {
  // .env.local doesn't exist or can't be read, that's okay
}

const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

const NFT_CONTRACT_ABI = parseAbi([
  "function baseTokenURI() external view returns (string)",
]);

async function verifyURI() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  const uri = await publicClient.readContract({
    address: NFT_CONTRACT_ADDRESS as `0x${string}`,
    abi: NFT_CONTRACT_ABI,
    functionName: "baseTokenURI",
  });

  console.log("📋 Current Base URI:", uri);
  console.log("✅ Expected:", "https://khitab.vercel.app/api/nft/metadata");
  console.log("\nMatch:", uri === "https://khitab.vercel.app/api/nft/metadata" ? "✅ YES" : "❌ NO");
}

verifyURI();

