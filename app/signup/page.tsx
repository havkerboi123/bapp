"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

export default function SignupPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || !address) {
    if (typeof window !== "undefined") {
      router.replace("/");
    }
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !storeName || !username || !email) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          storeName,
          username,
          email,
          walletAddress: address,
        }),
      });

      if (!res.ok) {
        throw new Error("Signup failed");
      }

      router.push("/");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "24px",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "2.5rem",
          boxShadow: "0 20px 60px rgba(0, 82, 255, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04)",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontWeight: 600, color: "rgba(0,0,0,0.6)" }}>Step 1: Wallet</div>
          <div style={{ fontWeight: 600, color: "#0052FF" }}>
            Step 2: Signup
          </div>
        </div>

        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            background: "linear-gradient(135deg, #0052FF 0%, #00D4FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Create your ledger profile
        </h1>
        <p
          style={{
            fontSize: "0.9375rem",
            color: "rgba(0,0,0,0.65)",
            marginBottom: "1.5rem",
            lineHeight: "1.6",
          }}
        >
          These details are for your account. Your Base wallet is already connected:
          <br />
          <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "rgba(0,0,0,0.5)" }}>
            {address}
          </span>
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div>
            <label
              htmlFor="name"
              style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (e.g. Ahmed Khan)"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 12,
                border: "1.5px solid rgba(0,0,0,0.12)",
                fontSize: "0.9375rem",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0052FF";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 82, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              htmlFor="storeName"
              style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}
            >
              Store name
            </label>
            <input
              id="storeName"
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Store name (e.g. Al-Madina Kiryana Store)"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 12,
                border: "1.5px solid rgba(0,0,0,0.12)",
                fontSize: "0.9375rem",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0052FF";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 82, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              htmlFor="username"
              style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username for the app (e.g. ahmedkhata)"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 12,
                border: "1.5px solid rgba(0,0,0,0.12)",
                fontSize: "0.9375rem",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0052FF";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 82, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: "0.85rem", marginBottom: 4 }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email for updates and backup"
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: 12,
                border: "1.5px solid rgba(0,0,0,0.12)",
                fontSize: "0.9375rem",
                transition: "all 0.2s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0052FF";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0, 82, 255, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {error && (
            <p style={{ color: "red", fontSize: "0.8rem" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: "0.5rem",
              padding: "0.875rem 2rem",
              borderRadius: 12,
              border: "none",
              background: "#0052FF",
              color: "white",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: isSubmitting ? "wait" : "pointer",
              boxShadow: "0 4px 12px rgba(0, 82, 255, 0.3)",
              transition: "all 0.2s",
              opacity: isSubmitting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = "#0040CC";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 82, 255, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.background = "#0052FF";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 82, 255, 0.3)";
              }
            }}
          >
            {isSubmitting ? "Creating profile..." : "Finish signup"}
          </button>
        </form>
      </div>
    </main>
  );
}


