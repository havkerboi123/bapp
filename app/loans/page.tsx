"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { parseAbi, decodeEventLog, createPublicClient, http } from "viem";
import { baseSepolia } from "wagmi/chains";

const LOAN_LEDGER_CONTRACT =
  process.env.NEXT_PUBLIC_LOAN_LEDGER_CONTRACT ||
  "0x0000000000000000000000000000000000000000";

// PKR to ETH exchange rate (1 ETH = X PKR)
// Update this rate as needed. Example: 1 ETH = 333,333 PKR means 1 PKR = 0.000003 ETH
const PKR_TO_ETH_RATE = parseFloat(process.env.NEXT_PUBLIC_PKR_TO_ETH_RATE || "0.000003"); // Default: 1 PKR = 0.000003 ETH

const LOAN_LEDGER_ABI = parseAbi([
  "function payLoan(bytes32 loanId) external payable",
  "event LoanPaid(bytes32 indexed loanId, address indexed owner, address indexed partner, uint256 amount, uint256 timestamp)",
]);

// Convert PKR amount to ETH (in wei)
function convertPKRToEthWei(pkrAmount: number): bigint {
  // Convert PKR to ETH
  const ethAmount = pkrAmount * PKR_TO_ETH_RATE;
  // Convert ETH to wei (1 ETH = 1e18 wei)
  const weiAmount = ethAmount * 1e18;
  return BigInt(Math.floor(weiAmount));
}

type PendingLoan = {
  id: string;
  amount: number;
  description: string | null;
  loanDate: string | null;
  expectedReturnDate: string | null;
  createdAt: string;
  ownerName: string;
  ownerUsername: string;
  ownerStoreName: string;
  status?: string;
};

type PaymentLoan = {
  id: string;
  onchainLoanId: string;
  contractAddress?: string | null; // Contract address where loan was recorded
  amount: number;
  ownerWallet: string;
  partnerWallet: string;
  description: string;
  ownerName?: string;
  ownerUsername?: string;
  ownerStoreName?: string;
  loanDate?: string | null;
  expectedReturnDate?: string | null;
};

export default function PendingLoansPage() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const [loans, setLoans] = useState<PendingLoan[]>([]);
  const [paymentLoans, setPaymentLoans] = useState<PaymentLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Payment hooks
  const { switchChain } = useSwitchChain();
  const { writeContract, data: paymentTxHash, isPending: isPaying, error: paymentError } = useWriteContract();
  const { isLoading: isConfirmingPayment, isSuccess: isPaymentConfirmed, data: paymentReceipt } = useWaitForTransactionReceipt({
    hash: paymentTxHash,
  });

  useEffect(() => {
    // Don't redirect immediately - wait for wallet to connect
    if (!isConnected || !address) {
      // Only redirect if wallet is definitely not connected after a delay
      const timer = setTimeout(() => {
        if (!isConnected || !address) {
          router.replace("/");
        }
      }, 2000); // Increased delay to 2 seconds
      return () => clearTimeout(timer);
    }

    const loadPendingLoans = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/loans/pending?partnerWallet=${encodeURIComponent(address)}`,
        );
        const data = await res.json();

        if (!res.ok) {
          // 404 might mean user not found OR no pending loans
          // Check the error message to determine which
          if (res.status === 404 && data.error?.includes("not found")) {
            // User not found - redirect to signup
            router.replace("/");
            return;
          }
          // Otherwise, just show empty state (no pending loans)
          setLoans([]);
          setPaymentLoans([]);
          setLoading(false);
          return;
        }

        const allLoans = data.loans ?? [];
        // Separate pending loans (for acceptance) from payment loans
        const pending = allLoans.filter((loan: PendingLoan) => loan.status === "pending");
        const payment = allLoans
          .filter((loan: any) => loan.status === "waiting on payment" && loan.onchainLoanId)
          .map((loan: any) => ({
            id: loan.id,
            onchainLoanId: loan.onchainLoanId,
            amount: loan.amount,
            ownerWallet: loan.ownerWallet || "",
            partnerWallet: loan.partnerWallet || "",
            description: loan.description || "",
            ownerName: loan.ownerName,
            ownerUsername: loan.ownerUsername,
            ownerStoreName: loan.ownerStoreName,
            loanDate: loan.loanDate,
            expectedReturnDate: loan.expectedReturnDate,
          }));
        
        setLoans(pending);
        setPaymentLoans(payment);
      } catch {
        setError("Network issue. Dobara koshish karein.");
      } finally {
        setLoading(false);
      }
    };

    void loadPendingLoans();
  }, [isConnected, address, router]);

  const handleAcceptReject = async (loanId: string, action: "accept" | "reject") => {
    if (!address) return;

    setProcessingId(loanId);
    setError(null);

    try {
      const res = await fetch("/api/loans/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loanId,
          partnerWallet: address,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Loan accept/reject karne mein masla aya.");
        return;
      }

      // Remove from pending list
      setLoans((prev) => prev.filter((loan) => loan.id !== loanId));
    } catch {
      setError("Network issue. Dobara koshish karein.");
    } finally {
      setProcessingId(null);
    }
  };

  const handlePayLoan = async (paymentLoan: PaymentLoan) => {
    console.log("handlePayLoan called with:", paymentLoan);
    
    if (!address || !isConnected) {
      console.error("Missing address or not connected:", { address, isConnected });
      setError("Wallet not connected. Please connect your wallet.");
      return;
    }
    console.log("✓ Wallet connected:", { address, isConnected });

    // Check if on correct network (Base Sepolia) and switch if needed
    if (chain && chain.id !== 84532) {
      console.warn("Wrong network:", chain.id, "Switching to Base Sepolia...");
      try {
        await switchChain({ chainId: baseSepolia.id });
        // Wait a moment for the switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        setError(null);
        // Retry the payment after network switch
        // The user will need to click the button again after switching
        setError("Network switched! Please click 'Pay' again to proceed.");
        setPayingLoanId(null);
        return;
      } catch (switchError: any) {
        console.error("Failed to switch network:", switchError);
        setError("Please switch to Base Sepolia network (Chain ID: 84532) manually in MetaMask.");
        setPayingLoanId(null);
        return;
      }
    }
    console.log("✓ Network check passed:", chain ? `Chain ID: ${chain.id}` : "Chain not detected (will proceed)");

    // Use the contract address from the loan (if stored) or fall back to env variable
    const contractToUse = paymentLoan.contractAddress || LOAN_LEDGER_CONTRACT;
    
    if (!contractToUse || contractToUse === "0x0000000000000000000000000000000000000000") {
      console.error("Contract not set");
      setError("Contract not deployed. Please contact support.");
      return;
    }
    console.log("✓ Contract address:", contractToUse, paymentLoan.contractAddress ? "(from loan)" : "(from env)");

    if (!paymentLoan.onchainLoanId) {
      console.error("Missing onchainLoanId");
      setError("Loan ID not found. This loan may not be recorded on-chain yet.");
      return;
    }
    console.log("✓ Loan ID found:", paymentLoan.onchainLoanId);

    setPayingLoanId(paymentLoan.id);
    setError(null);
    console.log("✓ Set payingLoanId, starting transaction...");

    try {
      // Convert PKR amount to ETH (in wei)
      const amountInWei = convertPKRToEthWei(paymentLoan.amount);
      console.log("✓ Amount converted:", {
        pkr: paymentLoan.amount,
        eth: (paymentLoan.amount * PKR_TO_ETH_RATE).toFixed(6),
        wei: amountInWei.toString(),
        rate: `${PKR_TO_ETH_RATE} ETH per PKR`,
      });
      
      // Ensure onchainLoanId is properly formatted as bytes32 (0x + 64 hex chars)
      let loanIdBytes: `0x${string}`;
      if (paymentLoan.onchainLoanId.startsWith("0x")) {
        // Pad to 66 characters (0x + 64 hex chars) if needed
        const hexPart = paymentLoan.onchainLoanId.slice(2);
        if (hexPart.length === 64) {
          loanIdBytes = paymentLoan.onchainLoanId as `0x${string}`;
        } else {
          // Pad with zeros
          loanIdBytes = `0x${hexPart.padStart(64, "0")}` as `0x${string}`;
        }
      } else {
        // Add 0x prefix and pad
        loanIdBytes = `0x${paymentLoan.onchainLoanId.padStart(64, "0")}` as `0x${string}`;
      }

      console.log("=".repeat(60));
      console.log("💸 INITIATING PAYMENT");
      console.log("=".repeat(60));
      console.log("Payment FROM (Partner):", address);
      console.log("Payment TO (Owner):", paymentLoan.ownerWallet);
      console.log("Amount:", paymentLoan.amount, "PKR");
      console.log("Amount in Wei:", amountInWei.toString());
      console.log("Loan ID:", paymentLoan.onchainLoanId);
      console.log("Contract:", contractToUse);
      console.log("=".repeat(60));

      writeContract({
        address: contractToUse as `0x${string}`,
        abi: LOAN_LEDGER_ABI,
        functionName: "payLoan",
        args: [loanIdBytes],
        value: amountInWei,
      });
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Payment transaction failed. Check console for details.");
      setPayingLoanId(null);
    }
  };

  // Handle payment confirmation - auto-detect when transaction is confirmed
  useEffect(() => {
    if (isPaymentConfirmed && paymentTxHash && payingLoanId && paymentReceipt) {
      console.log("Payment confirmed! Updating loan status...", {
        loanId: payingLoanId,
        txHash: paymentReceipt.transactionHash,
        address,
      });
      
      const updatePayment = async () => {
        try {
          console.log("Calling /api/loans/pay to update status...");
          const res = await fetch("/api/loans/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              loanId: payingLoanId,
              partnerWallet: address,
              txHash: paymentReceipt.transactionHash,
            }),
          });

          const responseData = await res.json();
          console.log("Payment API response:", { status: res.status, data: responseData });

          if (!res.ok) {
            console.error("Failed to update loan:", responseData);
            setError(responseData.error || "Failed to update loan after payment");
            return;
          }

          console.log("✓ Loan status updated successfully!");

          // Remove from payment list and reload
          setPaymentLoans((prev) => prev.filter((loan) => loan.id !== payingLoanId));
          setPayingLoanId(null);
          
          // Reload all loans
          console.log("Reloading loans...");
          const loadRes = await fetch(
            `/api/loans/pending?partnerWallet=${encodeURIComponent(address!)}`,
          );
          if (loadRes.ok) {
            const data = await loadRes.json();
            console.log("Reloaded loans:", data);
            const allLoans = data.loans ?? [];
            const pending = allLoans.filter((loan: PendingLoan) => loan.status === "pending");
            const payment = allLoans
              .filter((loan: any) => loan.status === "waiting on payment" && loan.onchainLoanId)
              .map((loan: any) => ({
                id: loan.id,
                onchainLoanId: loan.onchainLoanId,
                contractAddress: loan.contractAddress,
                amount: loan.amount,
                ownerWallet: loan.ownerWallet || "",
                partnerWallet: loan.partnerWallet || "",
                description: loan.description || "",
                ownerName: loan.ownerName,
                ownerUsername: loan.ownerUsername,
                ownerStoreName: loan.ownerStoreName,
                loanDate: loan.loanDate,
                expectedReturnDate: loan.expectedReturnDate,
              }));
            setLoans(pending);
            setPaymentLoans(payment);
            console.log("✓ Loans reloaded. Pending:", pending.length, "Payment:", payment.length);
          } else {
            console.error("Failed to reload loans");
          }
        } catch (err) {
          console.error("Failed to update loan after payment:", err);
          setError("Payment successful but failed to update loan status. Please refresh the page.");
        }
      };

      void updatePayment();
    }
  }, [isPaymentConfirmed, paymentTxHash, payingLoanId, address, paymentReceipt]);

  // Auto-detect payment by polling transaction status if we have a tx hash but no confirmation
  useEffect(() => {
    if (paymentTxHash && payingLoanId && !isPaymentConfirmed && !isConfirmingPayment) {
      // Find the loan to get its contract address
      const loanToUpdate = paymentLoans.find(loan => loan.id === payingLoanId);
      
      console.log("Transaction sent but not confirmed yet. Polling for confirmation...", {
        txHash: paymentTxHash,
        loanId: payingLoanId,
        contractAddress: loanToUpdate?.contractAddress,
      });

      const pollTransaction = async () => {
        try {
          const client = createPublicClient({
            chain: baseSepolia,
            transport: http("https://sepolia.base.org")
          });
          
          let attempts = 0;
          const maxAttempts = 30; // Poll for up to 30 attempts (5 minutes)
          
          const checkInterval = setInterval(async () => {
            attempts++;
            try {
              const receipt = await client.getTransactionReceipt({ hash: paymentTxHash });
              
              if (receipt && receipt.status === "success") {
                console.log("✓ Transaction confirmed via polling!", receipt);
                clearInterval(checkInterval);
                
                // Update loan status
                const res = await fetch("/api/loans/pay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    loanId: payingLoanId,
                    partnerWallet: address,
                    txHash: paymentTxHash,
                  }),
                });

                if (res.ok) {
                  // Reload loans
                  const loadRes = await fetch(
                    `/api/loans/pending?partnerWallet=${encodeURIComponent(address!)}`,
                  );
                  if (loadRes.ok) {
                    const data = await loadRes.json();
                    const allLoans = data.loans ?? [];
                    const pending = allLoans.filter((loan: PendingLoan) => loan.status === "pending");
                    const payment = allLoans
                      .filter((loan: any) => loan.status === "waiting on payment" && loan.onchainLoanId)
                      .map((loan: any) => ({
                        id: loan.id,
                        onchainLoanId: loan.onchainLoanId,
                        contractAddress: loan.contractAddress,
                        amount: loan.amount,
                        ownerWallet: loan.ownerWallet || "",
                        partnerWallet: loan.partnerWallet || "",
                        description: loan.description || "",
                        ownerName: loan.ownerName,
                        ownerUsername: loan.ownerUsername,
                        ownerStoreName: loan.ownerStoreName,
                        loanDate: loan.loanDate,
                        expectedReturnDate: loan.expectedReturnDate,
                      }));
                    setLoans(pending);
                    setPaymentLoans(payment);
                    setPayingLoanId(null);
                    console.log("✓ Loan status updated via polling!");
                  }
                }
              } else if (receipt && receipt.status === "reverted") {
                console.error("Transaction reverted!");
                clearInterval(checkInterval);
                setError("Transaction failed. Please try again.");
                setPayingLoanId(null);
              }
            } catch (err: any) {
              // Transaction not found yet, continue polling
              if (err.message?.includes("not found")) {
                console.log(`Polling attempt ${attempts}/${maxAttempts}...`);
              } else {
                console.error("Error polling transaction:", err);
              }
            }
            
            if (attempts >= maxAttempts) {
              console.warn("Max polling attempts reached. Transaction may still be pending.");
              clearInterval(checkInterval);
            }
          }, 10000); // Check every 10 seconds

          // Cleanup on unmount or when confirmed
          return () => clearInterval(checkInterval);
        } catch (err) {
          console.error("Error setting up transaction polling:", err);
        }
      };

      void pollTransaction();
    }
  }, [paymentTxHash, payingLoanId, isPaymentConfirmed, isConfirmingPayment, address, paymentLoans]);

  // Handle payment errors
  useEffect(() => {
    if (paymentError && payingLoanId) {
      console.error("Payment transaction error:", paymentError);
      setError(paymentError.message || "Payment transaction failed. Please check your wallet and try again.");
      setPayingLoanId(null);
    }
  }, [paymentError, payingLoanId]);

  // Manual update function - call this if payment succeeded but status wasn't updated
  const manuallyUpdatePaymentStatus = async (loanId: string, txHash: string) => {
    if (!address) return;
    
    try {
      console.log("Manually updating payment status...", { loanId, txHash });
      const res = await fetch("/api/loans/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanId,
          partnerWallet: address,
          txHash,
        }),
      });

      const responseData = await res.json();
      console.log("Manual update response:", responseData);

      if (!res.ok) {
        setError(responseData.error || "Failed to update loan status");
        return;
      }

      // Reload loans
      const loadRes = await fetch(
        `/api/loans/pending?partnerWallet=${encodeURIComponent(address)}`,
      );
      if (loadRes.ok) {
        const data = await loadRes.json();
        const allLoans = data.loans ?? [];
        const pending = allLoans.filter((loan: PendingLoan) => loan.status === "pending");
        const payment = allLoans
          .filter((loan: any) => loan.status === "waiting on payment" && loan.onchainLoanId)
          .map((loan: any) => ({
            id: loan.id,
            onchainLoanId: loan.onchainLoanId,
            amount: loan.amount,
            ownerWallet: loan.ownerWallet || "",
            partnerWallet: loan.partnerWallet || "",
            description: loan.description || "",
            ownerName: loan.ownerName,
            ownerUsername: loan.ownerUsername,
            ownerStoreName: loan.ownerStoreName,
            loanDate: loan.loanDate,
            expectedReturnDate: loan.expectedReturnDate,
          }));
        setLoans(pending);
        setPaymentLoans(payment);
        setError(null);
        alert("Loan status updated successfully!");
      }
    } catch (err) {
      console.error("Failed to manually update:", err);
      setError("Failed to update loan status. Please try again.");
    }
  };

  if (!isConnected || !address) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.6)",
          }}
        >
          Wallet connect kar rahe hain...
          <br />
          <span style={{ fontSize: "0.8rem", marginTop: "0.5rem", display: "block" }}>
            {!isConnected && "Please connect your wallet"}
            {isConnected && !address && "Waiting for wallet address..."}
          </span>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #e0f0ff 0, transparent 45%), radial-gradient(circle at bottom right, #fbe7ff 0, transparent 40%), #f7f9fc",
        padding: "2rem 1.5rem 3rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 800,
          background: "white",
          borderRadius: 20,
          padding: "2rem",
          boxShadow: "0 20px 45px rgba(15,112,255,0.08)",
        }}
      >
        <header style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                margin: 0,
              }}
            >
              Pending Loans
            </h1>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <Link
                href="/nft"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#764ba2",
                  textDecoration: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid rgba(118,75,162,0.2)",
                  background: "rgba(118,75,162,0.05)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(118,75,162,0.1)";
                  e.currentTarget.style.borderColor = "rgba(118,75,162,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(118,75,162,0.05)";
                  e.currentTarget.style.borderColor = "rgba(118,75,162,0.2)";
                }}
              >
                <span>🎉</span>
                <span>My NFTs</span>
              </Link>
              <Link
                href="/dashboard"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#0f70ff",
                  textDecoration: "none",
                  padding: "0.5rem 1rem",
                  borderRadius: 8,
                  border: "1px solid rgba(15,112,255,0.2)",
                  background: "rgba(15,112,255,0.05)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(15,112,255,0.1)";
                  e.currentTarget.style.borderColor = "rgba(15,112,255,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(15,112,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(15,112,255,0.2)";
                }}
              >
                <span>🏠</span>
                <span>Dashboard</span>
              </Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p
              style={{
                fontSize: "0.9rem",
                color: "rgba(0,0,0,0.6)",
                margin: 0,
              }}
            >
              Aap ke naam par jo loans hain, unhein accept ya reject karein. Jo loans accept ho chuki hain, unhein pay karein.
            </p>
            <button
              onClick={() => {
                if (!address) return;
                setLoading(true);
                fetch(`/api/loans/pending?partnerWallet=${encodeURIComponent(address)}`)
                  .then(res => res.json())
                  .then(data => {
                    const allLoans = data.loans ?? [];
                    const pending = allLoans.filter((loan: PendingLoan) => loan.status === "pending");
                    const payment = allLoans
                      .filter((loan: any) => loan.status === "waiting on payment" && loan.onchainLoanId)
                      .map((loan: any) => ({
                        id: loan.id,
                        onchainLoanId: loan.onchainLoanId,
                        amount: loan.amount,
                        ownerWallet: loan.ownerWallet || "",
                        partnerWallet: loan.partnerWallet || "",
                        description: loan.description || "",
                        ownerName: loan.ownerName,
                        ownerUsername: loan.ownerUsername,
                        ownerStoreName: loan.ownerStoreName,
                        loanDate: loan.loanDate,
                        expectedReturnDate: loan.expectedReturnDate,
                      }));
                    setLoans(pending);
                    setPaymentLoans(payment);
                    setLoading(false);
                  })
                  .catch(err => {
                    console.error("Failed to refresh:", err);
                    setLoading(false);
                  });
              }}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.2)",
                background: "white",
                color: "#0f70ff",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              🔄 Refresh
            </button>
          </div>
        </header>

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "#f8d7da",
              color: "#721c24",
              borderRadius: 8,
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "rgba(0,0,0,0.6)" }}>Loading...</p>
        ) : loans.length === 0 && paymentLoans.length === 0 ? (
          <p
            style={{
              fontSize: "0.9rem",
              color: "rgba(0,0,0,0.6)",
              textAlign: "center",
              padding: "2rem",
            }}
          >
            Abhi tak koi pending loan nahi hai.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
            }}
          >
            {/* Pending Loans Section */}
            {loans.length > 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    marginBottom: "1rem",
                    color: "rgba(0,0,0,0.8)",
                  }}
                >
                  Pending Loans (Accept/Reject)
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {loans.map((loan) => (
              <div
                key={loan.id}
                style={{
                  padding: "1.25rem",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 12,
                  background: "#fffbf0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.75rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        marginBottom: "0.25rem",
                      }}
                    >
                      {loan.ownerName}{" "}
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "rgba(0,0,0,0.55)",
                        }}
                      >
                        (@{loan.ownerUsername})
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "rgba(0,0,0,0.6)",
                      }}
                    >
                      Store: {loan.ownerStoreName}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "#d0312d",
                    }}
                  >
                    {loan.amount.toLocaleString("en-PK")} PKR
                  </div>
                </div>

                {loan.description && (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "rgba(0,0,0,0.7)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {loan.description}
                  </div>
                )}

                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(0,0,0,0.5)",
                    marginBottom: "1rem",
                  }}
                >
                  Loan date: {loan.loanDate || "—"} · Expected return:{" "}
                  {loan.expectedReturnDate || "—"}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                  }}
                >
                  <button
                    onClick={() => handleAcceptReject(loan.id, "accept")}
                    disabled={processingId === loan.id}
                    style={{
                      flex: 1,
                      padding: "0.6rem 1rem",
                      borderRadius: 8,
                      border: "none",
                      background: "#28a745",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: processingId === loan.id ? "wait" : "pointer",
                      opacity: processingId === loan.id ? 0.6 : 1,
                    }}
                  >
                    {processingId === loan.id ? "Processing..." : "✓ Accept"}
                  </button>
                  <button
                    onClick={() => handleAcceptReject(loan.id, "reject")}
                    disabled={processingId === loan.id}
                    style={{
                      flex: 1,
                      padding: "0.6rem 1rem",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.2)",
                      background: "white",
                      color: "#d0312d",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      cursor: processingId === loan.id ? "wait" : "pointer",
                      opacity: processingId === loan.id ? 0.6 : 1,
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Loans Section */}
            {paymentLoans.length > 0 && (
              <div>
                <h2
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    marginBottom: "1rem",
                    color: "rgba(0,0,0,0.8)",
                  }}
                >
                  Loans Waiting for Payment
                </h2>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {paymentLoans.map((loan) => (
                      <div
                        key={loan.id}
                        style={{
                          padding: "1.25rem",
                          border: "1px solid rgba(15,112,255,0.2)",
                          borderRadius: 12,
                          background: "#e7f3ff",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.75rem",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: "1rem",
                                fontWeight: 600,
                                marginBottom: "0.25rem",
                              }}
                            >
                              {loan.ownerName || "Owner"}{" "}
                              {loan.ownerUsername && (
                                <span
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "rgba(0,0,0,0.55)",
                                  }}
                                >
                                  (@{loan.ownerUsername})
                                </span>
                              )}
                            </div>
                            {loan.ownerStoreName && (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "rgba(0,0,0,0.6)",
                                }}
                              >
                                Store: {loan.ownerStoreName}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 700,
                              color: "#d0312d",
                            }}
                          >
                            {loan.amount.toLocaleString("en-PK")} PKR
                          </div>
                        </div>

                        {loan.description && (
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "rgba(0,0,0,0.7)",
                              marginBottom: "0.5rem",
                            }}
                          >
                            {loan.description}
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "rgba(0,0,0,0.5)",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Loan date: {loan.loanDate || "—"} · Expected return:{" "}
                          {loan.expectedReturnDate || "—"}
                        </div>

                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "rgba(0,0,0,0.5)",
                            marginBottom: "1rem",
                            padding: "0.5rem",
                            background: "rgba(15,112,255,0.1)",
                            borderRadius: 6,
                          }}
                        >
                          ⏳ Status: Waiting on Payment
                        </div>

                        <button
                          onClick={() => handlePayLoan(loan)}
                          disabled={payingLoanId === loan.id || isPaying || isConfirmingPayment}
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            borderRadius: 8,
                            border: "none",
                            background: payingLoanId === loan.id || isPaying || isConfirmingPayment ? "#6c757d" : "#0f70ff",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            cursor: payingLoanId === loan.id || isPaying || isConfirmingPayment ? "wait" : "pointer",
                            opacity: payingLoanId === loan.id || isPaying || isConfirmingPayment ? 0.6 : 1,
                          }}
                        >
                          {payingLoanId === loan.id || isPaying || isConfirmingPayment
                            ? isConfirmingPayment
                              ? "Confirming Payment..."
                              : "Processing Payment..."
                            : `💳 Pay ${loan.amount.toLocaleString("en-PK")} PKR`}
                        </button>
                      </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

