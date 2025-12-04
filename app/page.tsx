"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<"signup" | "signin" | null>(null);

  const handleSignup = async () => {
    if (!isConnected || !address) {
      setError("Please connect your Base wallet first.");
      return;
    }

    setError(null);
    setLoadingAction("signup");

    try {
      const res = await fetch(
        `/api/signup?walletAddress=${encodeURIComponent(address)}`,
      );

      if (res.ok) {
        // User already exists for this wallet
        setError("This wallet is already registered. Please sign in.");
        return;
      }

      if (res.status === 404) {
        router.push("/signup");
        return;
      }

      setError("Something went wrong. Please try again in a moment.");
    } catch (e) {
      setError("Network issue. Please check your internet and try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignin = async () => {
    if (!isConnected || !address) {
      setError("Please connect your Base wallet first.");
      return;
    }

    setError(null);
    setLoadingAction("signin");

    try {
      const res = await fetch(
        `/api/signup?walletAddress=${encodeURIComponent(address)}`,
      );

      if (res.ok) {
        router.push("/signin");
        return;
      }

      if (res.status === 404) {
        setError("No account found with this wallet. Please sign up first.");
        return;
      }

      setError("Something went wrong. Please try again in a moment.");
    } catch (e) {
      setError("Network issue. Please check your internet and try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.headerWrapper}>
        <Wallet>
          <ConnectWallet />
        </Wallet>
      </header>

      <div className={styles.content}>
        <div className={styles.heroCard}>
          <div className={styles.leftCol}>
            <div className={styles.stepper}>
              <div className={`${styles.step} ${styles.stepActive}`}>
                <div className={styles.stepNumber}>1</div>
                <div>Connect Base wallet</div>
              </div>
              <div
                className={`${styles.step} ${
                  isConnected ? styles.stepActive : ""
                }`}
              >
                <div className={styles.stepNumber}>2</div>
                <div>Create your ledger profile</div>
              </div>
            </div>

            <h1 className={styles.appTitle}>
              <span className={styles.titleMain}>Khitab</span>
              <span className={styles.titleAI}>AI</span>
            </h1>
            <p className={styles.tagline}>
              Urdu voice AI ledger for Pakistani shopkeepers
            </p>
            <p className={styles.heroSubtitle}>
              Digitize your shop's old register. On Base, record credit using Urdu voice, check accounts, and send crypto payments directly from your wallet, all on base.
            </p>

            <div className={styles.actionsRow}>
              <button
                className={styles.primaryButton}
                onClick={handleSignup}
                disabled={loadingAction !== null}
              >
                {loadingAction === "signup" ? "Checking..." : "Sign up with Base"}
              </button>

              <button
                className={styles.secondaryButton}
                onClick={handleSignin}
                disabled={loadingAction !== null}
              >
                {loadingAction === "signin" ? "Checking..." : "Sign in with Base"}
              </button>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <div className={styles.rightCol}>
            <div className={styles.avatarGrid}>
              <div className={styles.avatar}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="50" fill="#0052FF"/>
                  <text x="50" y="65" fontFamily="Arial, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">$</text>
                </svg>
              </div>
              <div className={styles.avatar}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="50" fill="#00D4FF"/>
                  {/* Shopkeeper with hat */}
                  <circle cx="50" cy="35" r="12" fill="white"/>
                  <ellipse cx="50" cy="50" rx="18" ry="20" fill="white"/>
                  <path d="M35 50 Q50 45 65 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                  <rect x="42" y="25" width="16" height="8" rx="4" fill="white"/>
                </svg>
              </div>
              <div className={styles.avatar}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="50" fill="#0052FF"/>
                  {/* Shopkeeper with turban */}
                  <circle cx="50" cy="35" r="12" fill="white"/>
                  <ellipse cx="50" cy="50" rx="18" ry="20" fill="white"/>
                  <path d="M35 50 Q50 45 65 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
                  <ellipse cx="50" cy="28" rx="14" ry="6" fill="white"/>
                  <ellipse cx="50" cy="25" rx="10" ry="4" fill="white"/>
                </svg>
              </div>
              <div className={styles.avatar}>
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="50" cy="50" r="50" fill="#00D4FF"/>
                  <text x="50" y="65" fontFamily="Arial, sans-serif" fontSize="50" fontWeight="bold" fill="white" textAnchor="middle">$</text>
                </svg>
              </div>
            </div>
            <div className={styles.moneyIcons}>
              <div className={styles.moneyIcon}>
                <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="30" cy="30" r="28" fill="#0052FF" opacity="0.2"/>
                  <text x="30" y="40" fontFamily="Arial, sans-serif" fontSize="35" fontWeight="bold" fill="#0052FF" textAnchor="middle">$</text>
                </svg>
              </div>
              <div className={styles.moneyIcon}>
                <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="30" cy="30" r="28" fill="#00D4FF" opacity="0.2"/>
                  <text x="30" y="40" fontFamily="Arial, sans-serif" fontSize="35" fontWeight="bold" fill="#00D4FF" textAnchor="middle">$</text>
                </svg>
              </div>
            </div>
            <div className={styles.artDecoration}>
              <div className={styles.floatingShape}></div>
              <div className={styles.floatingShape}></div>
              <div className={styles.floatingShape}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
