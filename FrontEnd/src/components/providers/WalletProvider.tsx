"use client";

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_ENDPOINT } from "@/lib/config";

// Default import for wallet-adapter-react-ui styles — we override them in globals.css
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wraps the app tree with Solana wallet-adapter providers.
 * Modern Solana wallets (Phantom, Solflare, Backpack) implement the Solana Wallet Standard
 * and are automatically registered by the provider without legacy adapter dependencies.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => RPC_ENDPOINT, []);
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
