"use client";
import { ReactNode } from "react";
import { baseSepolia } from "wagmi/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import "@coinbase/onchainkit/styles.css";

export function RootProvider({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={baseSepolia}
      config={{
        appearance: {
          name: "Urdu Voice Ledger",
          logo: "https://your-logo-url.example.com/logo.png",
          mode: "auto",
        },
        wallet: {
          display: "modal",
          preference: "all",
          termsUrl: "https://example.com/terms",
          privacyUrl: "https://example.com/privacy",
        },
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}
