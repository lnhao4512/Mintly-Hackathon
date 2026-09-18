"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { SolanaIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";

interface MintModalProps {
  open: boolean;
  onClose: () => void;
  onBackToCanvas?: () => void;
  onConfirm: (onProgress: (step: MintProgressStep) => void) => Promise<{ signature?: string; mintAddress?: string } | void>;
  title: string;
  description: string;
  previewUrl: string | null;
}

type MintProgressStep =
  | "preparing"
  | "awaiting-wallet"
  | "confirming"
  | "success";

type MintStatus = "idle" | MintProgressStep | "error";

/**
 * Confirmation modal before minting an NFT.
 *
 * Shows artwork preview, metadata summary, estimated fee,
 * and handles minting states (loading, success, error).
 */
export function MintModal({
  open,
  onClose,
  onBackToCanvas,
  onConfirm,
  title,
  description,
  previewUrl,
}: MintModalProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<MintStatus>("idle");
  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "preparing" || status === "awaiting-wallet" || status === "confirming";
  const truncatedMintAddress = mintAddress
    ? `${mintAddress.slice(0, 6)}...${mintAddress.slice(-6)}`
    : null;

  if (!open) return null;

  const handleClose = () => {
    onClose();
    setStatus("idle");
    setMintAddress(null);
    setErrorMsg(null);
    setToast(null);
  };

  const handleBackToCanvas = () => {
    onBackToCanvas?.();
    handleClose();
  };

  const handleConfirm = async () => {
    setStatus("preparing");
    setErrorMsg(null);
    setToast(null);

    try {
      const result = await onConfirm((nextStep) => {
        if (nextStep === "success") {
          setStatus("success");
          return;
        }

        setStatus(nextStep);
      });

      if (result?.mintAddress) {
        setMintAddress(result.mintAddress);
      }

      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : t("mint.failed");
      setErrorMsg(message);
      setStatus("error");

      if (message === "Transaction rejected by user") {
        setToast(message);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current && !isBusy) {
      handleClose();
    }
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      {toast && (
        <div className="absolute right-6 top-6 z-[110] rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200 shadow-lg">
          {toast}
        </div>
      )}

      <div className="relative w-full max-w-lg mx-4 overflow-hidden rounded-3xl border border-line-glass bg-[rgba(26,25,25,0.97)] shadow-[0px_25px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h3 className="font-display text-xl text-text">Mint Artifact</h3>
          {!isBusy && (
            <button
              onClick={handleClose}
              className="flex size-8 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-white/5 hover:text-text"
              aria-label={t("mint.close")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6 p-6">
          {previewUrl && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t("mint.artworkPreview")}
                className="size-full object-contain bg-white"
              />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{t("create.artworkTitle")}</span>
              <span className="font-sans text-sm text-text">
                {title || t("create.titlePlaceholder")}
              </span>
            </div>
            {description && (
              <div className="flex flex-col gap-1">
                <span className="eyebrow">{t("mint.description")}</span>
                <span className="font-sans text-xs leading-5 text-text-dim line-clamp-2">
                  {description}
                </span>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-white/5 pt-3">
              <span className="eyebrow">{t("mint.network")}</span>
              <span className="flex items-center gap-1.5 font-sans text-sm text-text">
                <SolanaIcon className="size-3.5" width={14} height={14} />
                Solana Devnet
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">{t("mint.estFee")}</span>
              <span className="font-sans text-sm text-text-dim">~0.01 SOL</span>
            </div>
          </div>

          {status === "idle" && (
            <div className="flex gap-4 pt-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-full border border-white/10 px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-colors hover:border-text"
              >
                {t("mint.cancel")}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isBusy}
                className="flex-1 rounded-full bg-accent px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(184,165,255,0.7)]"
              >
                {t("mint.confirm")}
              </button>
            </div>
          )}

          {(status === "preparing" || status === "awaiting-wallet" || status === "confirming") && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative size-12">
                <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent" />
              </div>
              <span className="eyebrow text-accent-strong animate-pulse">
                {status === "preparing" && t("mint.preparing")}
                {status === "awaiting-wallet" && t("mint.awaitingWallet")}
                {status === "confirming" && t("mint.confirming")}
              </span>
              <span className="text-xs text-text-dim">
                {status === "preparing" && t("mint.preparingText")}
                {status === "awaiting-wallet" && t("mint.awaitingWalletText")}
                {status === "confirming" && t("mint.confirmingText")}
              </span>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10 text-green-400">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                  <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="font-display text-lg text-text">{t("mint.success")}</span>
              {mintAddress && (
                <div className="w-full rounded-2xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-center text-xs text-text">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-green-300">{t("mint.address")}</span>
                  <span className="font-mono text-[11px] text-text" title={mintAddress}>
                    {truncatedMintAddress}
                  </span>
                </div>
              )}
              {mintAddress && (
                <div className="flex w-full flex-col gap-2.5">
                  <Link
                    href="/portfolio"
                    className="w-full rounded-full bg-accent px-6 py-4 text-center font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(184,165,255,0.7)]"
                  >
                    {t("mint.viewPortfolio")} 🎨
                  </Link>
                  <a
                    href={`https://explorer.solana.com/address/${mintAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-center font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-colors hover:border-white/20"
                  >
                    {t("mint.viewExplorer")} ↗
                  </a>
                </div>
              )}
              <button
                onClick={handleBackToCanvas}
                className="mt-2 w-full rounded-full border border-white/10 px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-colors hover:border-text"
              >
                {t("mint.backCanvas")}
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                  <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-display text-lg text-text">{t("mint.failed")}</span>
              <span className="text-center text-xs text-red-400/80">{errorMsg}</span>
              <div className="flex w-full gap-4 pt-2">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-full border border-white/10 px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-colors hover:border-text"
                >
                  {t("mint.close")}
                </button>
                <button
                  onClick={() => setStatus("idle")}
                  className="flex-1 rounded-full bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition-all hover:bg-accent-strong"
                >
                  {t("mint.tryAgain")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
