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
      setError("Pehle apna Base wallet connect karein.");
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
        setError("Yeh wallet pehle se registered hai. Sign in karein.");
        return;
      }

      if (res.status === 404) {
        router.push("/signup");
        return;
      }

      setError("Kuch ghalat ho gaya. Thori dair baad dobara koshish karein.");
    } catch (e) {
      setError("Network issue. Internet check karein aur dobara koshish karein.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignin = async () => {
    if (!isConnected || !address) {
      setError("Pehle apna Base wallet connect karein.");
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
        setError("Is wallet ke sath koi account nahi mila. Pehle sign up karein.");
        return;
      }

      setError("Kuch ghalat ho gaya. Thori dair baad dobara koshish karein.");
    } catch (e) {
      setError("Network issue. Internet check karein aur dobara koshish karein.");
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
                <div>Create your khata profile</div>
              </div>
            </div>

            <h1 className={styles.heroTitle}>
              Urdu Voice AI Ledger for Pakistani Shopkeepers
            </h1>
            <p className={styles.heroSubtitle}>
              Apni dukaan ka purana register digital bana dein. Base par Urdu
              voice se udhaar likhwain, hisaab check karein, aur USDC payments
              bhejain – seedha apne wallet se.
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

            {!error && (
              <p className={styles.helperText}>
                Pehle wallet connect karein, phir naya khata banayein ya pehle se
                bana hua khata open karein.
              </p>
            )}
            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <div className={styles.rightCol}>
            <Image
              priority
              src="/sphere.svg"
              alt="Urdu Ledger"
              width={260}
              height={260}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
