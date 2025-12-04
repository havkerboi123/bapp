"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi, decodeEventLog } from "viem";

// Contract ABI and address
const LOAN_LEDGER_ABI = parseAbi([
  "function recordLoan(address partner, uint256 amount, string memory description, uint256 loanDate, uint256 expectedReturnDate) external returns (bytes32)",
  "event LoanRecorded(bytes32 indexed loanId, address indexed owner, address indexed partner, uint256 amount, uint256 timestamp, string description, uint256 loanDate, uint256 expectedReturnDate)",
]);

const LOAN_LEDGER_CONTRACT =
  process.env.NEXT_PUBLIC_LOAN_LEDGER_CONTRACT ||
  "0x0000000000000000000000000000000000000000";

// PKR to ETH exchange rate (1 ETH = X PKR)
// Update this rate as needed. Example: 1 ETH = 333,333 PKR means 1 PKR = 0.000003 ETH
const PKR_TO_ETH_RATE = parseFloat(process.env.NEXT_PUBLIC_PKR_TO_ETH_RATE || "0.000003"); // Default: 1 PKR = 0.000003 ETH

// Convert PKR amount to ETH (contract will multiply by 1e18)
function convertPKRToEth(pkrAmount: number): number {
  return pkrAmount * PKR_TO_ETH_RATE;
}

type Partner = {
  id: string;
  username: string;
  name: string;
  walletAddress?: string;
};

type Loan = {
  id: string;
  partnerName?: string;
  partnerUsername?: string;
  partnerWallet?: string;
  ownerName?: string;
  ownerUsername?: string;
  ownerWallet?: string;
  amount: number;
  description: string | null;
  loanDate: string | null;
  expectedReturnDate: string | null;
  txHash?: string | null;
  status?: string;
  loanType?: "given" | "taken";
  onchainLoanId?: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();

  const [currentUser, setCurrentUser] = useState<{ name: string; username: string } | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansGiven, setLoansGiven] = useState<Loan[]>([]);
  const [loansTaken, setLoansTaken] = useState<Loan[]>([]);
  const [totalLoan, setTotalLoan] = useState<number>(0);
  const [totalLoanGiven, setTotalLoanGiven] = useState<number>(0);
  const [totalLoanTaken, setTotalLoanTaken] = useState<number>(0);
  const [partnerCount, setPartnerCount] = useState<number>(0);

  const [newPartnerUsername, setNewPartnerUsername] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);

  const [loanPartnerId, setLoanPartnerId] = useState<string>("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDescription, setLoanDescription] = useState("");
  const [loanDate, setLoanDate] = useState("");
  const [loanExpectedReturn, setLoanExpectedReturn] = useState("");
  const [loanError, setLoanError] = useState<string | null>(null);
  const [loanLoading, setLoanLoading] = useState(false);
  const [acceptedLoansNeedingTx, setAcceptedLoansNeedingTx] = useState<
    Loan[]
  >([]);
  const [recordingLoanId, setRecordingLoanId] = useState<string | null>(null);
  
  // Audio recording states
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcribedText, setTranscribedText] = useState<string>("");
  const [transcribing, setTranscribing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // On-chain recording hooks
  const { writeContract, data: txHash, isPending: isRecording, error: writeError } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } =
    useWaitForTransactionReceipt({
      hash: txHash,
    });

  // Auto-record accepted loans on-chain when owner is on dashboard
  useEffect(() => {
    if (
      !isConnected ||
      !address ||
      acceptedLoansNeedingTx.length === 0 ||
      recordingLoanId ||
      isRecording ||
      isConfirming
    ) {
      return;
    }

    const recordNextLoan = async () => {
      const loanToRecord = acceptedLoansNeedingTx[0];
      if (!loanToRecord.partnerWallet) {
        console.warn("Loan missing partnerWallet:", loanToRecord);
        return;
      }

      console.log("Recording loan on-chain:", {
        loanId: loanToRecord.id,
        partnerWallet: loanToRecord.partnerWallet,
        amount: loanToRecord.amount,
        contractAddress: LOAN_LEDGER_CONTRACT,
      });

      setRecordingLoanId(loanToRecord.id);

      try {
        // Check if on correct network (Base Sepolia)
        if (chain?.id !== 84532) {
          console.warn("Wrong network! Please switch to Base Sepolia (Chain ID: 84532)");
          alert("Please switch to Base Sepolia network in MetaMask to record loans on-chain.");
          setAcceptedLoansNeedingTx((prev) => prev.slice(1));
          setRecordingLoanId(null);
          return;
        }

        const loanDateUnix = loanToRecord.loanDate
          ? Math.floor(new Date(loanToRecord.loanDate).getTime() / 1000)
          : Math.floor(Date.now() / 1000);
        const expectedReturnUnix = loanToRecord.expectedReturnDate
          ? Math.floor(new Date(loanToRecord.expectedReturnDate).getTime() / 1000)
          : 0;

        if (
          !LOAN_LEDGER_CONTRACT ||
          LOAN_LEDGER_CONTRACT === "0x0000000000000000000000000000000000000000"
        ) {
          // Contract not deployed, skip
          console.warn("Contract not deployed or address not set");
          setAcceptedLoansNeedingTx((prev) => prev.slice(1));
          setRecordingLoanId(null);
          return;
        }

        // Convert PKR amount to ETH, then to wei
        // Example: 15 PKR * 0.000003 = 0.000045 ETH
        // Convert to wei: 0.000045 * 1e18 = 45000000000000 wei
        const ethAmount = convertPKRToEth(loanToRecord.amount);
        const weiAmount = BigInt(Math.floor(ethAmount * 1e18));
        
        console.log("Calling writeContract with:", {
          address: LOAN_LEDGER_CONTRACT,
          partner: loanToRecord.partnerWallet,
          pkrAmount: loanToRecord.amount,
          ethAmount: ethAmount.toFixed(6),
          weiAmount: weiAmount.toString(),
          rate: `${PKR_TO_ETH_RATE} ETH per PKR`,
        });
        
        writeContract({
          address: LOAN_LEDGER_CONTRACT as `0x${string}`,
          abi: LOAN_LEDGER_ABI,
          functionName: "recordLoan",
          args: [
            loanToRecord.partnerWallet as `0x${string}`,
            weiAmount, // Pass amount in wei (already converted from PKR to ETH)
            loanToRecord.description || "",
            BigInt(loanDateUnix),
            BigInt(expectedReturnUnix),
          ],
        });
      } catch (err) {
        console.error("Failed to record loan on-chain:", err);
        // Remove from queue if error
        setAcceptedLoansNeedingTx((prev) => prev.slice(1));
        setRecordingLoanId(null);
      }
    };

    // Add a small delay to batch updates and prevent rapid-fire calls
    const timeoutId = setTimeout(() => {
      void recordNextLoan();
    }, 100); // 100ms delay

    return () => clearTimeout(timeoutId);
  }, [
    isConnected,
    address,
    acceptedLoansNeedingTx.length, // Only depend on length, not the array itself
    recordingLoanId,
    isRecording,
    isConfirming,
    // Removed writeContract from dependencies - it's stable
  ]);

  // Handle write errors (e.g., user denied transaction) - separate useEffect
  useEffect(() => {
    if (writeError && recordingLoanId) {
      console.warn("Transaction error (user may have denied):", writeError);
      // Remove from queue so it doesn't keep retrying
      setAcceptedLoansNeedingTx((prev) => prev.slice(1));
      setRecordingLoanId(null);
    }
  }, [writeError, recordingLoanId]);

  // When transaction is confirmed, update loan with tx hash and on-chain loan ID
  useEffect(() => {
    if (isConfirmed && txHash && recordingLoanId && receipt) {
      // Use receipt transaction hash if available, otherwise use the original hash
      const finalTxHash = receipt.transactionHash || txHash;
      
      // Extract loan ID from the LoanRecorded event in the receipt logs
      let onchainLoanId: string | undefined;
      try {
        const contractAddress = LOAN_LEDGER_CONTRACT as `0x${string}`;
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
            try {
              const decoded = decodeEventLog({
                abi: LOAN_LEDGER_ABI,
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "LoanRecorded") {
                onchainLoanId = decoded.args.loanId as string;
                break;
              }
            } catch (e) {
              // Not the event we're looking for, continue
            }
          }
        }
      } catch (err) {
        console.warn("Failed to extract loan ID from receipt:", err);
      }

      console.log("Transaction confirmed, updating loan with tx hash:", {
        loanId: recordingLoanId,
        txHash: finalTxHash,
        onchainLoanId,
        receiptHash: receipt.transactionHash,
        originalHash: txHash,
      });
      
      const updateLoan = async () => {
        try {
          const res = await fetch("/api/loans/update-tx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              loanId: recordingLoanId,
              txHash: finalTxHash,
              onchainLoanId: onchainLoanId,
            }),
          });

          if (!res.ok) {
            const error = await res.json();
            console.error("Failed to update loan with tx hash:", error);
            return;
          }

          console.log("Loan updated with tx hash successfully");

          // Reload loans to show updated tx hash
          const loansRes = await fetch(
            `/api/loans?ownerWallet=${encodeURIComponent(address!)}`,
          );
          if (loansRes.ok) {
            const data = await loansRes.json();
            setLoans(data.loans ?? []);
          }

          // Remove from pending list
          setAcceptedLoansNeedingTx((prev) => prev.slice(1));
          setRecordingLoanId(null);
        } catch (err) {
          console.error("Failed to update loan with tx hash:", err);
        }
      };

      void updateLoan();
    }
  }, [isConfirmed, txHash, recordingLoanId, address, receipt]);

  useEffect(() => {
    if (!isConnected || !address) {
      router.replace("/");
      return;
    }

    const loadData = async () => {
      try {
        const [userRes, partnersRes, loansRes] = await Promise.all([
          fetch(`/api/signup?walletAddress=${encodeURIComponent(address)}`),
          fetch(`/api/partners?ownerWallet=${encodeURIComponent(address)}`),
          fetch(`/api/loans?ownerWallet=${encodeURIComponent(address)}&partnerWallet=${encodeURIComponent(address)}`),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData.user) {
            setCurrentUser({
              name: userData.user.name,
              username: userData.user.username,
            });
          }
        }

        if (partnersRes.ok) {
          const data = await partnersRes.json();
          setPartners(data.partners ?? []);
          setPartnerCount(data.partnerCount ?? data.partners?.length ?? 0);
          if (data.partners?.length && !loanPartnerId) {
            setLoanPartnerId(data.partners[0].id);
          }
        }

        if (loansRes.ok) {
          const data = await loansRes.json();
          setLoans(data.loans ?? []);
          setLoansGiven(data.loansGiven ?? []);
          setLoansTaken(data.loansTaken ?? []);
          setTotalLoan(data.totalLoan ?? 0);
          setTotalLoanGiven(data.totalLoanGiven ?? 0);
          setTotalLoanTaken(data.totalLoanTaken ?? 0);

          // Find accepted loans that need on-chain recording (no txHash yet)
          // Only from loans given (where user is owner)
          const acceptedWithoutTx = data.loansGiven?.filter(
            (loan: Loan) =>
              loan.status === "accepted" && !loan.txHash && loan.partnerWallet,
          );
          console.log("Accepted loans needing on-chain recording:", {
            count: acceptedWithoutTx?.length || 0,
            loans: acceptedWithoutTx,
            contractAddress: LOAN_LEDGER_CONTRACT,
          });
          setAcceptedLoansNeedingTx(acceptedWithoutTx ?? []);
        }
      } catch {
        // ignore for now; could add toast later
      }
    };

    void loadData();

    // Poll for updates every 10 seconds to refresh loan statuses
    const pollInterval = setInterval(() => {
      void loadData();
    }, 10000); // 10 seconds

    // Also refresh when window regains focus (user comes back to tab)
    const handleFocus = () => {
      void loadData();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isConnected, address, router, loanPartnerId]);

  if (!isConnected || !address) {
    return null;
  }

  const handleAddPartner = async (e: FormEvent) => {
    e.preventDefault();
    setPartnerError(null);

    if (!newPartnerUsername.trim()) {
      setPartnerError("Partner ka username likhein.");
      return;
    }

    setPartnerLoading(true);

    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerWallet: address,
          partnerUsername: newPartnerUsername.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPartnerError(data.error ?? "Partner add karne mein masla aya.");
        return;
      }

      setPartners((prev) => [...prev, data.partner]);
      setPartnerCount((c) => c + 1);
      setNewPartnerUsername("");
      if (!loanPartnerId) {
        setLoanPartnerId(data.partner.id);
      }
    } catch {
      setPartnerError("Network issue. Dobara koshish karein.");
    } finally {
      setPartnerLoading(false);
    }
  };

  const handleAddLoan = async (e: FormEvent) => {
    e.preventDefault();
    setLoanError(null);

    if (!loanPartnerId) {
      setLoanError("Pehle partner select karein.");
      return;
    }

    const amountNumber = Number(loanAmount);
    if (!amountNumber || amountNumber <= 0) {
      setLoanError("Sahi amount likhein (e.g. 200).");
      return;
    }

    // Find partner to get wallet address
    const selectedPartner = partners.find((p) => p.id === loanPartnerId);
    if (!selectedPartner || !selectedPartner.walletAddress) {
      setLoanError("Partner wallet address nahi mila.");
      return;
    }

    setLoanLoading(true);

    try {
      // Save to database as "pending" - partner must accept first
      // On-chain recording will happen when partner accepts
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ownerWallet: address,
          partnerId: loanPartnerId,
          amount: amountNumber,
          description: loanDescription || null,
          loanDate: loanDate || null,
          expectedReturnDate: loanExpectedReturn || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLoanError(data.error ?? "Loan add karne mein masla aya.");
        return;
      }

      // Loan is created as "pending" - don't add to list yet
      // It will appear after partner accepts
      setLoanAmount("");
      setLoanDescription("");
      setLoanDate("");
      setLoanExpectedReturn("");
      
      // Show success message
      alert(`Loan request sent to ${selectedPartner.name}. They need to accept it first.`);
      
      // Reload loans to show any newly accepted ones
      const loansRes = await fetch(`/api/loans?ownerWallet=${encodeURIComponent(address!)}`);
      if (loansRes.ok) {
        const loansData = await loansRes.json();
        setLoans(loansData.loans ?? []);
        setTotalLoan(loansData.totalLoan ?? 0);
      }
    } catch (err: any) {
      setLoanError(err.message || "Network issue. Dobara koshish karein.");
    } finally {
      setLoanLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #e0f0ff 0, transparent 45%), radial-gradient(circle at bottom right, #fbe7ff 0, transparent 40%), #f7f9fc",
        padding: "2rem 1.5rem 3rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {currentUser && (
        <div
          style={{
            width: "100%",
            maxWidth: 1100,
            marginBottom: "1.5rem",
            padding: "0.75rem 1.25rem",
            background: "white",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(15,112,255,0.08)",
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div>
            Currently signed in as: <strong>{currentUser.username}</strong>
          </div>
          <Link
            href="/nft"
            style={{
              padding: "0.5rem 1rem",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "0.9rem",
            }}
          >
            🎉 View My NFTs
          </Link>
        </div>
      )}
      {(!LOAN_LEDGER_CONTRACT ||
        LOAN_LEDGER_CONTRACT === "0x0000000000000000000000000000000000000000") && (
        <div
          style={{
            width: "100%",
            maxWidth: 1100,
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 12,
            fontSize: "0.85rem",
            color: "#856404",
          }}
        >
          ⚠️ <strong>Contract not configured:</strong> Add{" "}
          <code>NEXT_PUBLIC_LOAN_LEDGER_CONTRACT</code> to your{" "}
          <code>.env.local</code> file to enable on-chain recording.
        </div>
      )}
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: "2rem",
        }}
      >
        <section
          style={{
            background: "white",
            borderRadius: 20,
            padding: "1.75rem 2rem",
            boxShadow: "0 20px 45px rgba(15,112,255,0.08)",
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                }}
              >
              Khata dashboard
            </h1>
            <p
              style={{
                fontSize: "0.85rem",
                color: "rgba(0,0,0,0.6)",
                marginTop: 4,
              }}
            >
              Partners add karein aur unke naam par udhaar record karein.
            </p>
            <Link
              href="/loans"
              style={{
                fontSize: "0.8rem",
                color: "#0f70ff",
                textDecoration: "none",
                marginTop: "0.5rem",
                display: "inline-block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              → View pending loans sent to you
            </Link>
            </div>
            <div
              style={{
                textAlign: "right",
                fontSize: "0.8rem",
                color: "rgba(0,0,0,0.6)",
              }}
            >
              <div>Wallet:</div>
              <div style={{ fontFamily: "monospace" }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            </div>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1rem",
              marginBottom: "1.75rem",
            }}
          >
            <div
              style={{
                padding: "0.9rem 1rem",
                borderRadius: 14,
                background: "#f5f7ff",
              }}
            >
              <div
                style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.6)" }}
              >
                Total partners
              </div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {partnerCount}
              </div>
            </div>

            <div
              style={{
                padding: "0.9rem 1rem",
                borderRadius: 14,
                background: "#fff5f5",
              }}
            >
              <div
                style={{ fontSize: "0.8rem", color: "rgba(208,49,45,0.8)" }}
              >
                Total loan given
              </div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  marginTop: 4,
                  color: "#d0312d",
                }}
              >
                {totalLoan.toLocaleString("en-PK")} PKR
              </div>
            </div>

            <div
              style={{
                padding: "0.9rem 1rem",
                borderRadius: 14,
                background: "#f3f8ff",
              }}
            >
              <div
                style={{ fontSize: "0.8rem", color: "rgba(0,0,0,0.6)" }}
              >
                Loans recorded
              </div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {loans.length}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              Recent loans
            </h2>

            {loans.length === 0 ? (
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "rgba(0,0,0,0.55)",
                }}
              >
                Abhi tak koi loan record nahi hua. Pehle partner add karein aur
                phir neeche form se loan add karein.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                }}
              >
                {loans.map((loan) => (
                  <div
                    key={loan.id}
                    style={{
                      padding: "0.75rem 0.5rem",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.9rem",
                          fontWeight: 600,
                        }}
                      >
                        {loan.loanType === "taken" ? (
                          <>
                            {loan.ownerName}{" "}
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: "rgba(0,0,0,0.55)",
                              }}
                            >
                              (@{loan.ownerUsername})
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                marginLeft: "0.5rem",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                background: "#e0f2fe",
                                color: "#0e7490",
                              }}
                            >
                              Taken
                            </span>
                          </>
                        ) : (
                          <>
                            {loan.partnerName}{" "}
                            <span
                              style={{
                                fontSize: "0.8rem",
                                color: "rgba(0,0,0,0.55)",
                              }}
                            >
                              (@{loan.partnerUsername})
                            </span>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                marginLeft: "0.5rem",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "4px",
                                background: "#fee2e2",
                                color: "#d0312d",
                              }}
                            >
                              Given
                            </span>
                          </>
                        )}
                        {loan.status && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              marginLeft: "0.5rem",
                              padding: "0.15rem 0.4rem",
                              borderRadius: "4px",
                              background:
                                loan.status === "accepted"
                                  ? "#d4edda"
                                  : loan.status === "rejected"
                                    ? "#f8d7da"
                                    : loan.status === "waiting on payment"
                                      ? "#cfe2ff"
                                      : loan.status === "paid back"
                                        ? "#d1e7dd"
                                        : "#fff3cd",
                              color:
                                loan.status === "accepted"
                                  ? "#155724"
                                  : loan.status === "rejected"
                                    ? "#721c24"
                                    : loan.status === "waiting on payment"
                                      ? "#084298"
                                      : loan.status === "paid back"
                                        ? "#0f5132"
                                        : "#856404",
                            }}
                          >
                            {loan.status === "accepted"
                              ? "✓ Accepted"
                              : loan.status === "rejected"
                                ? "✗ Rejected"
                                : loan.status === "waiting on payment"
                                  ? "⏳ Waiting on Payment"
                                  : loan.status === "paid back"
                                    ? "✓ Paid Back"
                                    : "⏳ Pending"}
                          </span>
                        )}
                      </div>
                      {loan.description && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "rgba(0,0,0,0.6)",
                          }}
                        >
                          {loan.description}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "rgba(0,0,0,0.5)",
                          marginTop: 2,
                        }}
                      >
                        Date: {loan.loanDate || "—"} · Expected return:{" "}
                        {loan.expectedReturnDate || "—"}
                      </div>
                      {loan.txHash && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            marginTop: 4,
                          }}
                        >
                          <a
                            href={`https://sepolia.basescan.org/tx/${loan.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#0f70ff",
                              textDecoration: "none",
                              fontFamily: "monospace",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.textDecoration = "underline";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.textDecoration = "none";
                            }}
                          >
                            🔗 View on Base Sepolia: {loan.txHash.slice(0, 10)}...
                            {loan.txHash.slice(-8)}
                          </a>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        color: loan.loanType === "taken" ? "#0e7490" : "#d0312d",
                        fontSize: "0.95rem",
                      }}
                    >
                      {loan.amount.toLocaleString("en-PK")} PKR
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: "1.5rem 1.75rem",
              boxShadow: "0 16px 40px rgba(15,112,255,0.08)",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              Add partner
            </h2>
            <p
              style={{
                fontSize: "0.8rem",
                color: "rgba(0,0,0,0.6)",
                marginBottom: "0.75rem",
              }}
            >
              Partner ka username likhein (jo unhon ne is app par signup karte
              waqt choose kiya tha).
            </p>

            <form
              onSubmit={handleAddPartner}
              style={{ display: "grid", gap: "0.75rem" }}
            >
              <input
                type="text"
                placeholder="@partner_username"
                value={newPartnerUsername}
                onChange={(e) => setNewPartnerUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.8rem",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  fontSize: "0.9rem",
                }}
              />

              {partnerError && (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#d0312d",
                  }}
                >
                  {partnerError}
                </p>
              )}

              <button
                type="submit"
                disabled={partnerLoading}
                style={{
                  marginTop: "0.25rem",
                  padding: "0.6rem 1rem",
                  borderRadius: 999,
                  border: "none",
                  background: "#0f70ff",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: partnerLoading ? "wait" : "pointer",
                }}
              >
                {partnerLoading ? "Adding..." : "Add partner"}
              </button>
            </form>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: "1.5rem 1.75rem",
              boxShadow: "0 16px 40px rgba(15,112,255,0.08)",
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              Add loan for partner
            </h2>

            <form
              onSubmit={handleAddLoan}
              style={{
                display: "grid",
                gap: "0.75rem",
              }}
            >
              <div>
                <label
                  htmlFor="partner"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Partner
                </label>
                <select
                  id="partner"
                  value={loanPartnerId}
                  onChange={(e) => setLoanPartnerId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    fontSize: "0.9rem",
                    backgroundColor: "white",
                  }}
                >
                  <option value="">
                    {partners.length === 0
                      ? "Pehle partner add karein"
                      : "Partner select karein"}
                  </option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (@{p.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="amount"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Amount (PKR)
                </label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="1"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="e.g. 200"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              {/* Audio Recording Section */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Audio Input (Urdu) - یا تو لکھیں یا بول کر ریکارڈ کریں
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      if (isAudioRecording) {
                        // Stop recording
                        if (mediaRecorder && mediaRecorder.state !== "inactive") {
                          mediaRecorder.stop();
                        }
                        setIsAudioRecording(false);
                      } else {
                        // Start recording
                        try {
                          const stream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                              echoCancellation: true,
                              noiseSuppression: true,
                              sampleRate: 44100,
                            },
                          });
                          
                          // Try to use a format that's more widely supported
                          // Use mimeType if available, otherwise let browser choose
                          let mimeType = "audio/webm";
                          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
                            mimeType = "audio/webm;codecs=opus";
                          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
                            mimeType = "audio/mp4";
                          } else if (MediaRecorder.isTypeSupported("audio/wav")) {
                            mimeType = "audio/wav";
                          }
                          
                          const recorder = new MediaRecorder(stream, {
                            mimeType: mimeType,
                          });
                          const chunks: Blob[] = [];
                          
                          console.log("Recording with mimeType:", mimeType);
                          
                          // Store mimeType for use in onstop
                          const recordedMimeType = mimeType;

                          recorder.ondataavailable = (e) => {
                            if (e.data.size > 0) {
                              chunks.push(e.data);
                            }
                          };

                          recorder.onstop = async () => {
                            // Determine file extension based on recordedMimeType
                            let fileExtension = "webm";
                            let fileName = "recording.webm";
                            if (recordedMimeType.includes("mp4")) {
                              fileExtension = "mp4";
                              fileName = "recording.mp4";
                            } else if (recordedMimeType.includes("wav")) {
                              fileExtension = "wav";
                              fileName = "recording.wav";
                            }
                            
                            const audioBlob = new Blob(chunks, {
                              type: recordedMimeType,
                            });
                            
                            console.log("Audio blob created:", {
                              size: audioBlob.size,
                              type: audioBlob.type,
                              fileName: fileName,
                            });
                            
                            // Stop all tracks
                            stream.getTracks().forEach((track) => track.stop());

                            // Transcribe audio
                            setTranscribing(true);
                            setTranscribedText("");
                            
                            try {
                              const formData = new FormData();
                              formData.append("file", audioBlob, fileName);
                              formData.append("model", "scribe");
                              formData.append("language", "ur");
                              formData.append("domain", "phone-commerce");
                              
                              console.log("Sending audio to transcription API...");

                              const res = await fetch("/api/transcribe", {
                                method: "POST",
                                body: formData,
                              });

                              let data;
                              try {
                                data = await res.json();
                              } catch (parseError) {
                                const text = await res.text();
                                console.error("Failed to parse response:", text);
                                alert(`Transcription failed: Invalid response from server`);
                                return;
                              }
                              
                              console.log("API Response status:", res.status);
                              console.log("API Response data:", data);
                              
                              if (res.ok && data.success && data.text) {
                                setTranscribedText(data.text);
                                console.log("Transcribed text:", data.text);
                                console.log("Full API response:", data);
                                
                                // Extract loan information using OpenAI
                                setExtracting(true);
                                try {
                                  const extractRes = await fetch("/api/extract-loan-info", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ text: data.text }),
                                  });
                                  
                                  const extractData = await extractRes.json();
                                  
                                  if (extractRes.ok && extractData.success && extractData.loanInfo) {
                                    const info = extractData.loanInfo;
                                    console.log("Extracted loan info:", info);
                                    
                                    // Auto-fill form fields (handle null values from OpenAI)
                                    if (info.loanAmount !== null && info.loanAmount !== undefined) {
                                      setLoanAmount(info.loanAmount.toString());
                                    }
                                    if (info.description !== null && info.description !== undefined) {
                                      setLoanDescription(info.description);
                                    }
                                    if (info.loanDate !== null && info.loanDate !== undefined) {
                                      setLoanDate(info.loanDate);
                                    }
                                    if (info.expectedReturnDate !== null && info.expectedReturnDate !== undefined) {
                                      setLoanExpectedReturn(info.expectedReturnDate);
                                    }
                                    
                                    // Try to find partner by name
                                    if (info.partnerName !== null && info.partnerName !== undefined) {
                                      const foundPartner = partners.find(
                                        (p) =>
                                          p.name.toLowerCase().includes(info.partnerName!.toLowerCase()) ||
                                          p.username.toLowerCase().includes(info.partnerName!.toLowerCase())
                                      );
                                      if (foundPartner) {
                                        setLoanPartnerId(foundPartner.id);
                                        console.log("Found partner:", foundPartner.name);
                                      } else {
                                        console.log("Partner not found:", info.partnerName);
                                        alert(`Partner "${info.partnerName}" not found. Please select manually.`);
                                      }
                                    }
                                  } else {
                                    console.error("Extraction error:", extractData);
                                  }
                                } catch (extractErr: any) {
                                  console.error("Error extracting loan info:", extractErr);
                                  // Don't fail the whole process if extraction fails
                                } finally {
                                  setExtracting(false);
                                }
                              } else {
                                const errorMsg = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
                                console.error("Transcription error:", {
                                  status: res.status,
                                  statusText: res.statusText,
                                  data: data,
                                  error: errorMsg,
                                });
                                alert(`Transcription failed: ${errorMsg}${data?.hint ? `\n\nHint: ${data.hint}` : ""}`);
                              }
                            } catch (err: any) {
                              console.error("Error transcribing:", err);
                              alert(`Error: ${err.message}`);
                            } finally {
                              setTranscribing(false);
                            }
                          };

                          recorder.start();
                          setMediaRecorder(recorder);
                          setIsAudioRecording(true);
                        } catch (err: any) {
                          console.error("Error accessing microphone:", err);
                          alert("Microphone access denied or not available");
                        }
                      }
                    }}
                    style={{
                      padding: "0.6rem 1rem",
                      borderRadius: "8px",
                      border: "none",
                      background: isAudioRecording ? "#dc2626" : "#4F46E5",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    {isAudioRecording ? (
                      <>
                        <span>⏹️</span>
                        <span>Stop Recording</span>
                      </>
                    ) : (
                      <>
                        <span>🎤</span>
                        <span>Record Audio</span>
                      </>
                    )}
                  </button>
                  
                  {transcribing && (
                    <span style={{ fontSize: "0.85rem", color: "rgba(0,0,0,0.6)" }}>
                      Transcribing...
                    </span>
                  )}
                  
                  {extracting && (
                    <span style={{ fontSize: "0.85rem", color: "rgba(0,0,0,0.6)" }}>
                      Extracting loan info...
                    </span>
                  )}
                  
                  {isAudioRecording && (
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#dc2626",
                        animation: "pulse 1.5s infinite",
                      }}
                    />
                  )}
                </div>
                
                {transcribedText && (
                  <div
                    style={{
                      padding: "0.75rem",
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      marginTop: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                        color: "#0369a1",
                      }}
                    >
                      Transcribed Text:
                    </div>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#0c4a6e",
                        lineHeight: "1.5",
                      }}
                    >
                      {transcribedText}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="description"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  Description (optional)
                </label>
                <input
                  id="description"
                  type="text"
                  value={loanDescription}
                  onChange={(e) => setLoanDescription(e.target.value)}
                  placeholder="e.g. Ahmed ko 200 rupay udhar diye"
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.15)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label
                    htmlFor="loanDate"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      marginBottom: 4,
                    }}
                  >
                    Loan date
                  </label>
                  <input
                    id="loanDate"
                    type="date"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.7rem",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="expectedReturn"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      marginBottom: 4,
                    }}
                  >
                    Expected return date
                  </label>
                  <input
                    id="expectedReturn"
                    type="date"
                    value={loanExpectedReturn}
                    onChange={(e) => setLoanExpectedReturn(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.7rem",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              {loanError && (
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#d0312d",
                  }}
                >
                  {loanError}
                </p>
              )}

              <button
                type="submit"
                disabled={loanLoading}
                style={{
                  marginTop: "0.25rem",
                  padding: "0.6rem 1rem",
                  borderRadius: 999,
                  border: "none",
                  background: "#d0312d",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: loanLoading ? "wait" : "pointer",
                }}
              >
                {loanLoading ? "Adding..." : "Add loan"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}




