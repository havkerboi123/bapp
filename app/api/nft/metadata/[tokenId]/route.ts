import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";

const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

const NFT_CONTRACT_ABI = parseAbi([
  "function tokenIdToLoan(uint256 tokenId) external view returns (bytes32)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
]);

const LOAN_LEDGER_CONTRACT =
  process.env.NEXT_PUBLIC_LOAN_LEDGER_CONTRACT ||
  "0x0000000000000000000000000000000000000000";

const LOAN_LEDGER_ABI = [
  {
    inputs: [{ internalType: "bytes32", name: "loanId", type: "bytes32" }],
    name: "getLoan",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "address", name: "partner", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
          { internalType: "string", name: "description", type: "string" },
          { internalType: "uint256", name: "loanDate", type: "uint256" },
          { internalType: "uint256", name: "expectedReturnDate", type: "uint256" },
        ],
        internalType: "struct LoanLedger.LoanRecord",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// PKR to ETH rate for converting wei back to PKR
const PKR_TO_ETH_RATE = parseFloat(
  process.env.NEXT_PUBLIC_PKR_TO_ETH_RATE || "0.000003",
);

/**
 * Get NFT metadata for a specific token ID
 * Follows ERC-721 metadata standard
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { tokenId: string } },
) {
  try {
    const tokenId = parseInt(params.tokenId);

    if (isNaN(tokenId) || tokenId <= 0) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    // Get loan ID from token ID
    const loanId = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "tokenIdToLoan",
      args: [BigInt(tokenId)],
    });

    if (loanId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 },
      );
    }

    // Get loan details from LoanLedger contract
    const loan = await publicClient.readContract({
      address: LOAN_LEDGER_CONTRACT as `0x${string}`,
      abi: LOAN_LEDGER_ABI,
      functionName: "getLoan",
      args: [loanId],
    });

    // Get NFT owner
    const owner = await publicClient.readContract({
      address: NFT_CONTRACT_ADDRESS as `0x${string}`,
      abi: NFT_CONTRACT_ABI,
      functionName: "ownerOf",
      args: [BigInt(tokenId)],
    });

    // Convert amount from wei to PKR
    const amountWei = loan.amount;
    const amountEth = Number(amountWei) / 1e18;
    const amountPKR = Math.floor(amountEth / PKR_TO_ETH_RATE);

    // Format dates
    const loanDate = new Date(Number(loan.loanDate) * 1000).toLocaleDateString();
    const expectedReturnDate = new Date(
      Number(loan.expectedReturnDate) * 1000,
    ).toLocaleDateString();
    const timestamp = new Date(Number(loan.timestamp) * 1000).toLocaleDateString();

    // Generate a cool SVG image (you can customize this)
    const svgImage = generateSVGImage(amountPKR, loanDate);

    // Return ERC-721 metadata
    const metadata = {
      name: `Loan Repayment Achievement #${tokenId}`,
      description: `🏆 Achievement NFT for successfully repaying a loan of ${amountPKR.toLocaleString()} PKR. This NFT represents trust, responsibility, and financial integrity. A testament to your commitment to honoring financial obligations and building strong relationships.`,
      image: `data:image/svg+xml;base64,${Buffer.from(svgImage).toString("base64")}`,
      external_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/nft/${tokenId}`,
      attributes: [
        {
          trait_type: "Loan Amount",
          value: `${amountPKR} PKR`,
        },
        {
          trait_type: "Loan Date",
          value: loanDate,
        },
        {
          trait_type: "Expected Return Date",
          value: expectedReturnDate,
        },
        {
          trait_type: "Repayment Date",
          value: timestamp,
        },
        {
          trait_type: "Owner Address",
          value: loan.owner,
        },
        {
          trait_type: "Partner Address",
          value: loan.partner,
        },
        {
          trait_type: "Loan ID",
          value: loanId,
        },
      ],
      properties: {
        loanId: loanId,
        owner: loan.owner,
        partner: loan.partner,
        amount: amountPKR.toString(),
        description: loan.description || "No description",
      },
    };

    return NextResponse.json(metadata, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate", // Disable cache for development
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("Error fetching NFT metadata:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Generate a beautiful SVG image for the NFT
 * Premium design with gradients, patterns, and modern aesthetics
 */
function generateSVGImage(amount: number, date: string): string {
  // Format amount with commas
  const formattedAmount = amount.toLocaleString();
  
  return `
    <svg width="500" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Main gradient background -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#f093fb;stop-opacity:1" />
        </linearGradient>
        
        <!-- Gold accent gradient -->
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FFD700;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FFA500;stop-opacity:1" />
        </linearGradient>
        
        <!-- Shine effect -->
        <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.3" />
          <stop offset="50%" style="stop-color:#ffffff;stop-opacity:0" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.1" />
        </linearGradient>
        
        <!-- Pattern for texture -->
        <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1" fill="white" opacity="0.1"/>
        </pattern>
        
        <!-- Shadow filter -->
        <filter id="shadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="500" height="500" fill="url(#bgGrad)"/>
      <rect width="500" height="500" fill="url(#dots)"/>
      <rect width="500" height="500" fill="url(#shine)"/>
      
      <!-- Decorative circles -->
      <circle cx="100" cy="100" r="80" fill="white" opacity="0.05"/>
      <circle cx="400" cy="400" r="100" fill="white" opacity="0.05"/>
      <circle cx="450" cy="50" r="60" fill="white" opacity="0.08"/>
      
      <!-- Main card/container -->
      <rect x="50" y="80" width="400" height="340" rx="30" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2" filter="url(#shadow)"/>
      
      <!-- Trophy/Medal Icon -->
      <g transform="translate(250, 180)">
        <!-- Trophy base -->
        <path d="M -40 20 L -30 60 L 30 60 L 40 20 Z" fill="url(#goldGrad)" opacity="0.9"/>
        <!-- Trophy cup -->
        <ellipse cx="0" cy="0" rx="35" ry="25" fill="url(#goldGrad)" opacity="0.9"/>
        <ellipse cx="0" cy="-5" rx="30" ry="20" fill="rgba(255,255,255,0.3)"/>
        <!-- Trophy handles -->
        <path d="M -35 -10 Q -50 -5 -50 5 Q -50 15 -35 10" stroke="url(#goldGrad)" stroke-width="4" fill="none" opacity="0.8"/>
        <path d="M 35 -10 Q 50 -5 50 5 Q 50 15 35 10" stroke="url(#goldGrad)" stroke-width="4" fill="none" opacity="0.8"/>
        <!-- Star on trophy -->
        <path d="M 0 -20 L 3 -12 L 12 -12 L 5 -6 L 8 2 L 0 -3 L -8 2 L -5 -6 L -12 -12 L -3 -12 Z" fill="white" opacity="0.9"/>
      </g>
      
      <!-- Main title -->
      <text x="250" y="280" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle" filter="url(#shadow)">
        Loan Repaid
      </text>
      
      <!-- Amount display with style -->
      <rect x="150" y="300" width="200" height="50" rx="25" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
      <text x="250" y="335" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="url(#goldGrad)" text-anchor="middle">
        ${formattedAmount} PKR
      </text>
      
      <!-- Date -->
      <text x="250" y="380" font-family="Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.9)" text-anchor="middle">
        ${date}
      </text>
      
      <!-- Badge at bottom -->
      <rect x="175" y="410" width="150" height="30" rx="15" fill="rgba(255,255,255,0.25)"/>
      <text x="250" y="430" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="white" text-anchor="middle" letter-spacing="1">
        ACHIEVEMENT NFT
      </text>
      
      <!-- Decorative corner elements -->
      <path d="M 50 80 L 80 80 L 50 110 Z" fill="rgba(255,255,255,0.1)"/>
      <path d="M 450 80 L 500 80 L 500 110 L 470 80 Z" fill="rgba(255,255,255,0.1)"/>
      <path d="M 50 420 L 50 450 L 80 450 Z" fill="rgba(255,255,255,0.1)"/>
      <path d="M 450 420 L 500 420 L 500 450 L 470 450 Z" fill="rgba(255,255,255,0.1)"/>
    </svg>
  `.trim();
}

