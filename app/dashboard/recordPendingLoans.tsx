"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useRecordLoan } from "@/lib/useRecordLoan";

/**
 * Component to handle recording accepted loans on-chain
 * This runs in the background when owner is on dashboard
 */
export function RecordPendingLoans({
  acceptedLoansWithoutTx,
}: {
  acceptedLoansWithoutTx: Array<{
    id: string;
    partnerWallet?: string;
    amount: number;
    description: string | null;
    loanDate: string | null;
    expectedReturnDate: string | null;
  }>;
}) {
  const { address, isConnected } = useAccount();
  const {
    recordLoan: recordLoanOnChain,
    hash: txHash,
    isPending: _isRecordingOnChain,
    isConfirmed: _isTxConfirmed,
  } = useRecordLoan();

  useEffect(() => {
    if (!isConnected || !address || acceptedLoansWithoutTx.length === 0) {
      return;
    }

    // Record each accepted loan on-chain
    const recordLoans = async () => {
      for (const loan of acceptedLoansWithoutTx) {
        if (!loan.partnerWallet) continue;

        try {
          const loanDateUnix = loan.loanDate
            ? Math.floor(new Date(loan.loanDate).getTime() / 1000)
            : Math.floor(Date.now() / 1000);
          const expectedReturnUnix = loan.expectedReturnDate
            ? Math.floor(new Date(loan.expectedReturnDate).getTime() / 1000)
            : 0;

          await recordLoanOnChain(
            loan.partnerWallet,
            loan.amount,
            loan.description || "",
            loanDateUnix,
            expectedReturnUnix,
          );

          // Wait for transaction to be confirmed
          if (txHash) {
            // Update loan with tx hash
            await fetch("/api/loans/update-tx", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                loanId: loan.id,
                txHash: txHash,
              }),
            });
          }
        } catch (err) {
          console.warn("Failed to record loan on-chain:", err);
          // Continue with next loan
        }
      }
    };

    void recordLoans();
  }, [isConnected, address, acceptedLoansWithoutTx, recordLoanOnChain, txHash]);

  return null; // This component doesn't render anything
}

