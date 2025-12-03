"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

export default function SigninPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isConnected || !address) {
      router.replace("/");
      return;
    }

    const checkUserAndRedirect = async () => {
      try {
        const res = await fetch(
          `/api/signup?walletAddress=${encodeURIComponent(address)}`,
        );

        if (res.status === 404) {
          // User doesn't exist → send back to home
          router.replace("/");
          return;
        }

        if (!res.ok) {
          // On error, go back home
          router.replace("/");
          return;
        }

        // User exists → redirect to dashboard
        router.replace("/dashboard");
      } catch {
        router.replace("/");
      } finally {
        setChecking(false);
      }
    };

    void checkUserAndRedirect();
  }, [isConnected, address, router]);

  if (!isConnected || !address || checking) {
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
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.65)",
          }}
        >
          Signing in...
        </div>
      </main>
    );
  }

  return null;
}


