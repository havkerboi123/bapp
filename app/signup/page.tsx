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
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          borderRadius: "1rem",
          border: "1px solid rgba(0,0,0,0.08)",
          padding: "2rem",
          boxShadow: "0 18px 45px rgba(15,112,255,0.08)",
          background: "white",
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
          <div style={{ fontWeight: 600 }}>Step 1: Wallet</div>
          <div style={{ fontWeight: 600, color: "#0f70ff" }}>
            Step 2: Signup
          </div>
        </div>

        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
          }}
        >
          Create your khata profile
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.65)",
            marginBottom: "1.5rem",
          }}
        >
          Yeh details sirf aap ke liye hain. Aapka Base wallet already connected
          hai:
          <br />
          <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
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
              placeholder="Aap ka naam (e.g. Ahmed Khan)"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
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
              placeholder="Dukaan ka naam (e.g. Al-Madina Kiryana Store)"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
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
              placeholder="App ke liye username (e.g. ahmedkhata)"
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
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
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.15)",
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
              padding: "0.75rem 1.25rem",
              borderRadius: 999,
              border: "none",
              background: "#0f70ff",
              color: "white",
              fontWeight: 600,
              cursor: isSubmitting ? "wait" : "pointer",
            }}
          >
            {isSubmitting ? "Creating profile..." : "Finish signup"}
          </button>
        </form>
      </div>
    </main>
  );
}


