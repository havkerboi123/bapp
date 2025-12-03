"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";

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
};

export default function PendingLoansPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [loans, setLoans] = useState<PendingLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setLoading(false);
          return;
        }

        setLoans(data.loans ?? []);
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
          <p
            style={{
              fontSize: "0.9rem",
              color: "rgba(0,0,0,0.6)",
            }}
          >
            Aap ke naam par jo loans hain, unhein accept ya reject karein.
          </p>
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
        ) : loans.length === 0 ? (
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
        )}
      </div>
    </main>
  );
}

