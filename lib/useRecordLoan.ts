"use client";

import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseAbi } from "viem";

// ABI for the LoanLedger contract
const LOAN_LEDGER_ABI = parseAbi([
  "function recordLoan(address partner, uint256 amount, string memory description, uint256 loanDate, uint256 expectedReturnDate) external returns (bytes32)",
  "event LoanRecorded(bytes32 indexed loanId, address indexed owner, address indexed partner, uint256 amount, uint256 timestamp, string description, uint256 loanDate, uint256 expectedReturnDate)",
]);

// Contract address - UPDATE THIS after deploying the contract
// For Base mainnet, you'll deploy and get an address
// For Base Sepolia testnet, use a testnet address
const LOAN_LEDGER_CONTRACT = process.env.NEXT_PUBLIC_LOAN_LEDGER_CONTRACT || "0x0000000000000000000000000000000000000000";

export function useRecordLoan() {
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const recordLoan = async (
    partnerAddress: string,
    amount: number, // PKR amount
    description: string,
    loanDate: number, // Unix timestamp
    expectedReturnDate: number // Unix timestamp
  ) => {
    if (!LOAN_LEDGER_CONTRACT || LOAN_LEDGER_CONTRACT === "0x0000000000000000000000000000000000000000") {
      throw new Error("LoanLedger contract not deployed. Please deploy the contract first.");
    }

    try {
      writeContract({
        address: LOAN_LEDGER_CONTRACT as `0x${string}`,
        abi: LOAN_LEDGER_ABI,
        functionName: "recordLoan",
        args: [
          partnerAddress as `0x${string}`,
          BigInt(amount), // Amount in PKR (contract multiplies by 1e18)
          description || "",
          BigInt(loanDate),
          BigInt(expectedReturnDate),
        ],
      });
    } catch (err) {
      console.error("Error recording loan on-chain:", err);
      throw err;
    }
  };

  return {
    recordLoan,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    receipt,
    error: writeError,
  };
}

