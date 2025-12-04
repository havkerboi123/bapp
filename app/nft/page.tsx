"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "wagmi/chains";

const NFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

const NFT_CONTRACT_ABI = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function tokenIdToLoan(uint256 tokenId) external view returns (bytes32)",
  "function totalSupply() external view returns (uint256)",
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

const PKR_TO_ETH_RATE = parseFloat(
  process.env.NEXT_PUBLIC_PKR_TO_ETH_RATE || "0.000003",
);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

type NFT = {
  tokenId: string;
  tokenURI: string;
  loanId: string;
  loanAmount: number;
  loanDate: string;
  metadata?: any;
};

export default function NFTPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      router.replace("/");
      return;
    }

    const loadNFTs = async () => {
      setLoading(true);
      setError(null);

      try {
        if (
          !NFT_CONTRACT_ADDRESS ||
          NFT_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000"
        ) {
          setError("NFT contract not configured");
          setLoading(false);
          return;
        }

        // Get total supply to know how many tokens exist
        const totalSupply = await publicClient.readContract({
          address: NFT_CONTRACT_ADDRESS as `0x${string}`,
          abi: NFT_CONTRACT_ABI,
          functionName: "totalSupply",
        });

        if (Number(totalSupply) === 0) {
          setNfts([]);
          setLoading(false);
          return;
        }

        // Get all token IDs owned by user by checking ownership of each token
        const tokenIds: bigint[] = [];
        const ownerAddress = address.toLowerCase();
        
        // Check each token from 1 to totalSupply
        for (let i = 1; i <= Number(totalSupply); i++) {
          try {
            const tokenOwner = await publicClient.readContract({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              abi: NFT_CONTRACT_ABI,
              functionName: "ownerOf",
              args: [BigInt(i)],
            });
            
            // Check if this token belongs to the user
            if (tokenOwner.toLowerCase() === ownerAddress) {
              tokenIds.push(BigInt(i));
            }
          } catch (e) {
            // Token might not exist, skip it
            console.log(`Token ${i} doesn't exist or error:`, e);
          }
        }

        if (tokenIds.length === 0) {
          setNfts([]);
          setLoading(false);
          return;
        }

        // Get metadata for each NFT
        const nftData: NFT[] = [];
        for (const tokenId of tokenIds) {
          try {
            // Get loan ID from token ID
            const loanId = await publicClient.readContract({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              abi: NFT_CONTRACT_ABI,
              functionName: "tokenIdToLoan",
              args: [tokenId],
            });

            // Get loan details
            let loanAmount = 0;
            let loanDate = "";
            if (
              LOAN_LEDGER_CONTRACT &&
              LOAN_LEDGER_CONTRACT !== "0x0000000000000000000000000000000000000000"
            ) {
              try {
                const loan = await publicClient.readContract({
                  address: LOAN_LEDGER_CONTRACT as `0x${string}`,
                  abi: LOAN_LEDGER_ABI,
                  functionName: "getLoan",
                  args: [loanId],
                });

                // Convert amount from wei to PKR
                const amountWei = loan.amount;
                const amountEth = Number(amountWei) / 1e18;
                loanAmount = Math.floor(amountEth / PKR_TO_ETH_RATE);
                loanDate = new Date(
                  Number(loan.loanDate) * 1000,
                ).toLocaleDateString();
              } catch (e) {
                console.error("Error fetching loan details:", e);
              }
            }

            // Get token URI
            const tokenURI = await publicClient.readContract({
              address: NFT_CONTRACT_ADDRESS as `0x${string}`,
              abi: NFT_CONTRACT_ABI,
              functionName: "tokenURI",
              args: [tokenId],
            });

            // Fetch metadata if it's a URL
            let metadata = null;
            if (tokenURI && tokenURI.startsWith("http")) {
              try {
                const metadataRes = await fetch(tokenURI);
                if (metadataRes.ok) {
                  metadata = await metadataRes.json();
                }
              } catch (e) {
                console.error("Error fetching metadata:", e);
              }
            }

            nftData.push({
              tokenId: tokenId.toString(),
              tokenURI: tokenURI || "",
              loanId: loanId,
              loanAmount,
              loanDate,
              metadata,
            });
          } catch (e) {
            console.error(`Error loading NFT ${tokenId}:`, e);
          }
        }

        setNfts(nftData);
      } catch (err: any) {
        console.error("Error loading NFTs:", err);
        setError(err.message || "Failed to load NFTs");
      } finally {
        setLoading(false);
      }
    };

    void loadNFTs();
  }, [isConnected, address, router]);

  if (!isConnected || !address) {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #e0f0ff 0, transparent 45%), radial-gradient(circle at bottom right, #fbe7ff 0, transparent 40%), #f7f9fc",
        padding: "2rem 1.5rem 3rem",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "2rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#1a1a1a",
                margin: 0,
                marginBottom: "0.5rem",
              }}
            >
              🎉 Achievement NFTs
            </h1>
            <p style={{ color: "rgba(0,0,0,0.6)", margin: 0 }}>
              Your loan repayment achievements
            </p>
          </div>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                padding: "0.75rem 1.5rem",
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                textDecoration: "none",
                color: "#333",
                fontWeight: "500",
                display: "inline-block",
              }}
            >
              ← Dashboard
            </Link>
            <Link
              href="/loans"
              style={{
                padding: "0.75rem 1.5rem",
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                textDecoration: "none",
                color: "#333",
                fontWeight: "500",
                display: "inline-block",
              }}
            >
              Loans
            </Link>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: "1rem",
              background: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c33",
              marginBottom: "2rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "rgba(0,0,0,0.6)",
            }}
          >
            Loading your NFTs...
          </div>
        )}

        {/* Empty State */}
        {!loading && nfts.length === 0 && !error && (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              background: "white",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎁</div>
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.5rem",
                color: "#333",
              }}
            >
              No NFTs Yet
            </h2>
            <p style={{ color: "rgba(0,0,0,0.6)", marginBottom: "2rem" }}>
              Pay back a loan to earn your first achievement NFT!
            </p>
            <Link
              href="/loans"
              style={{
                padding: "0.75rem 2rem",
                background: "#4F46E5",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "600",
                display: "inline-block",
              }}
            >
              View Loans
            </Link>
          </div>
        )}

        {/* NFT Grid */}
        {!loading && nfts.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {nfts.map((nft) => (
              <div
                key={nft.tokenId}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
                }}
              >
                {/* NFT Image */}
                <div
                  style={{
                    width: "100%",
                    height: "300px",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {nft.metadata?.image ? (
                    <img
                      src={nft.metadata.image}
                      alt={`NFT #${nft.tokenId}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        fontSize: "4rem",
                        color: "rgba(255,255,255,0.9)",
                      }}
                    >
                      🏆
                    </div>
                  )}
                </div>

                {/* NFT Info */}
                <div style={{ padding: "1.5rem" }}>
                  <h3
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: "bold",
                      marginBottom: "0.5rem",
                      color: "#333",
                    }}
                  >
                    {nft.metadata?.name || `Achievement #${nft.tokenId}`}
                  </h3>
                  {nft.metadata?.description && (
                    <p
                      style={{
                        color: "rgba(0,0,0,0.6)",
                        fontSize: "0.9rem",
                        marginBottom: "1rem",
                        lineHeight: "1.5",
                      }}
                    >
                      {nft.metadata.description}
                    </p>
                  )}

                  {/* Loan Details */}
                  <div
                    style={{
                      padding: "1rem",
                      background: "#f7f9fc",
                      borderRadius: "8px",
                      marginBottom: "1rem",
                    }}
                  >
                    {nft.loanAmount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <span style={{ color: "rgba(0,0,0,0.6)" }}>
                          Loan Amount:
                        </span>
                        <strong style={{ color: "#333" }}>
                          {nft.loanAmount} PKR
                        </strong>
                      </div>
                    )}
                    {nft.loanDate && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "rgba(0,0,0,0.6)" }}>
                          Date:
                        </span>
                        <strong style={{ color: "#333" }}>{nft.loanDate}</strong>
                      </div>
                    )}
                  </div>

                  {/* Links */}
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <a
                      href={`https://sepolia.basescan.org/token/${NFT_CONTRACT_ADDRESS}?a=${nft.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: "0.5rem 1rem",
                        background: "#f0f0f0",
                        borderRadius: "6px",
                        textDecoration: "none",
                        color: "#333",
                        fontSize: "0.85rem",
                        fontWeight: "500",
                      }}
                    >
                      View on BaseScan
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

