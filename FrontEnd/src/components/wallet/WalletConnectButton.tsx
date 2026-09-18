"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { WalletIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";

/**
 * Custom wallet connect button styled to match the MINTLY design system.
 *
 * - Disconnected → purple accent pill "Connect Wallet"
 * - Connecting → pulse animation
 * - Connected → truncated address with glassmorphism dropdown
 */
export function WalletConnectButton() {
  const { t } = useI18n();
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleCopy = useCallback(async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicKey]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setDropdownOpen(false);
  }, [disconnect]);

  // --- Connecting state ---
  if (connecting) {
    return (
      <button
        disabled
        className="ml-2 flex items-center gap-2 rounded-full bg-accent/60 px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] animate-pulse"
      >
        <span className="size-2 rounded-full bg-[#141313] animate-ping" />
        {t("wallet.connecting")}
      </button>
    );
  }

  // --- Connected state ---
  if (connected && publicKey) {
    return (
      <div ref={dropdownRef} className="relative ml-2">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-accent/30 bg-[rgba(184,165,255,0.08)] px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.15em] text-accent-strong transition-all hover:border-accent/60 hover:shadow-[0_0_20px_-6px_rgba(184,165,255,0.4)]"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-green-400" />
          </span>
          {truncatedAddress}
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-2xl border border-line-glass bg-[rgba(26,25,25,0.95)] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {/* Wallet info */}
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
              <WalletIcon className="size-4 text-accent" width={16} height={16} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">
                  {wallet?.adapter.name ?? "Wallet"}
                </span>
                <span className="font-mono text-xs text-text-dim-2">
                  {truncatedAddress}
                </span>
              </div>
            </div>

            {/* Copy address */}
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim transition-colors hover:bg-white/5 hover:text-text"
            >
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {copied ? t("wallet.copied") : t("wallet.copy")}
            </button>

            {/* Disconnect */}
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-3 border-t border-white/5 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.15em] text-red-400/80 transition-colors hover:bg-red-500/5 hover:text-red-400"
            >
              <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("wallet.disconnect")}
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- Default / disconnected state ---
  return (
    <button
      onClick={handleConnect}
      className="ml-2 rounded-full bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-10px_rgba(184,165,255,0.7)]"
    >
      {t("nav.connect")}
    </button>
  );
}
