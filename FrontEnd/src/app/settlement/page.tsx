"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { CheckIcon, WalletIcon, WarningIcon, SolanaIcon } from "@/components/ui/Icons";
import { fetchLiveAuctions, fetchAuctionById, type Auction } from "@/lib/data";
import { getMarketplaceProgram } from "@/utils/anchor";
import { getConfigPda, getAuctionEscrowAuthorityPda, WSOL_MINT } from "@/lib/config";
import { getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useI18n } from "@/lib/i18n";

function SettlementContent() {
  const { locale, toggleLocale, t } = useI18n();
  const searchParams = useSearchParams();
  const auctionId = searchParams.get("auction");
  const { connection } = useConnection();
  const wallet = useWallet();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (auctionId) {
          const item = await fetchAuctionById(connection, auctionId);
          if (item) setAuction(item);
        } else {
          const live = await fetchLiveAuctions(connection);
          if (live.length > 0) setAuction(live[0]);
        }
      } catch (e) {
        console.error("Failed to load settlement auction:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [connection, auctionId]);

  const totalSol = auction ? parseFloat(auction.currentBid) : 0;
  const depositSol = totalSol * 0.1;
  const balanceSol = totalSol * 0.9;

  const steps = [
    { n: "01", label: "WIN", state: "done" },
    { n: "02", label: "SECURE", state: txSuccess ? "done" : "active" },
    { n: "03", label: "OWN", state: txSuccess ? "active" : "upcoming" },
  ];

  async function handlePayDeposit() {
    if (!wallet.publicKey || !wallet.signTransaction || !auction) {
      setErrorMsg(t("nav.connect"));
      return;
    }

    setPaying(true);
    setErrorMsg(null);
    setTxSuccess(null);

    try {
      const program = getMarketplaceProgram(connection, wallet);
      const auctionPubkey = new PublicKey(auction.id);
      const [configPda] = getConfigPda();
      const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPubkey);

      const winnerPaymentAta = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet as any,
        WSOL_MINT,
        wallet.publicKey
      );

      const escrowPaymentAta = await getOrCreateAssociatedTokenAccount(
        connection,
        wallet as any,
        WSOL_MINT,
        escrowAuthority,
        true
      );

      const tx = await program.methods
        .payDeposit()
        .accounts({
          winner: wallet.publicKey,
          config: configPda,
          auction: auctionPubkey,
          winnerPaymentAccount: winnerPaymentAta.address,
          escrowAuthority,
          escrowPaymentAccount: escrowPaymentAta.address,
          paymentMint: WSOL_MINT,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSuccess(tx);
    } catch (err: any) {
      console.error("Settlement deposit error:", err);
      setErrorMsg(err.message || t("settlement.secure"));
    } finally {
      setPaying(false);
    }
  }

  const walletDisplay = wallet.publicKey
    ? `${wallet.publicKey.toBase58().slice(0, 4)}...${wallet.publicKey.toBase58().slice(-4)}`
    : "Wallet Disconnected";

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-6 pt-8 md:px-16">
        <Link href="/" className="font-display text-2xl tracking-[-1.2px] text-text">
          MINTLY
        </Link>
        <Link href="/auctions" className="eyebrow text-text-dim hover:text-text">
          &larr; {t("settlement.exit")}
        </Link>
        <button
          type="button"
          onClick={toggleLocale}
          className="rounded-full border border-white/10 px-3 py-2 font-mono text-[10px] font-bold tracking-[0.12em] text-text-dim hover:border-accent/40 hover:text-text"
          aria-label={t("nav.language")}
        >
          {locale === "en" ? "VI" : "EN"}
        </button>
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-[896px] grid-cols-1 gap-8 md:grid-cols-12">
          {/* Left Column: Art & Identity */}
          <div className="flex flex-col gap-8 md:col-span-5">
            <div className="flex flex-col gap-2">
              <h1 className="text-base font-medium leading-6 tracking-[-0.03em] text-text">
                {t("settlement.won")}
              </h1>
              <p className="max-w-96 text-base leading-6 text-text-dim">
                {t("settlement.description")}
              </p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-line-subtle bg-[rgba(34,34,34,0.4)] p-px backdrop-blur-md">
              <div className="relative aspect-square w-full">
                {auction ? (
                  <Image
                    src={auction.image}
                    alt={auction.title}
                    fill
                    priority
                    sizes="(max-width:768px) 100vw, 360px"
                    className="object-cover opacity-90"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-text-dim">
                    {loading ? t("settlement.loading") : t("settlement.noLot")}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <span className="text-xs uppercase tracking-[0.2em] text-accent">
                    {t("settlement.lot")}
                  </span>
                  <span className="text-base font-medium text-text">
                    {auction?.title || "Solana Collectible"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Settlement Panel */}
          <div className="flex flex-col gap-8 rounded-2xl border border-line-subtle bg-[rgba(34,34,34,0.4)] p-8 backdrop-blur-md md:col-span-7 md:p-10">
            {/* Timeline / stepper */}
            <div className="relative flex items-center justify-between">
              <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-accent to-white/10" />
              {steps.map((step) => (
                <div
                  key={step.label}
                  className={`relative z-10 flex flex-col items-center gap-2 rounded-lg bg-[#1a1919] p-2 ${
                    step.state === "upcoming" ? "opacity-40" : ""
                  } ${
                    step.state === "active"
                      ? "shadow-[0_0_0_1px_rgba(59,130,246,0.5)]"
                      : ""
                  }`}
                >
                  {step.state === "done" ? (
                    <CheckIcon className="size-4 text-text" width={16} height={16} />
                  ) : (
                    <span
                      className={`text-base leading-6 ${
                        step.state === "active" ? "text-accent" : "text-text"
                      }`}
                    >
                      {step.n}
                    </span>
                  )}
                  <span className="text-xs uppercase tracking-wider text-text">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between border-b border-line-subtle pb-3">
                  <span className="text-sm text-text-dim">{t("detail.leadingBid")}</span>
                <span className="text-base font-bold text-text">
                  {totalSol > 0 ? `${totalSol.toFixed(2)} SOL` : t("settlement.pending")}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-[rgba(34,34,34,0.3)] p-5">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-text">
                    <WarningIcon className="size-4 text-accent-strong" width={16} height={16} />
                    {t("settlement.depositDue")}
                  </span>
                  <span className="text-xs text-text-dim">{t("settlement.secures")}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-display text-lg text-accent">
                    {depositSol > 0 ? `${depositSol.toFixed(3)} SOL` : "—"}
                  </span>
                  <span className="text-xs text-text-dim">
                    {t("settlement.remaining")}: {balanceSol.toFixed(3)} SOL
                  </span>
                </div>
              </div>
            </div>

            {/* Connected wallet preview */}
            <div className="rounded-xl border border-white/[0.05] bg-[rgba(34,34,34,0.3)] p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-white/5 text-accent-strong">
                  <WalletIcon className="size-5" width={20} height={20} />
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-xs uppercase tracking-wider text-text">{t("settlement.connectedWallet")}</span>
                  <span className="font-mono text-xs text-text-dim">{walletDisplay}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm text-text">
                    -{depositSol > 0 ? depositSol.toFixed(3) : "0"} SOL
                  </span>
                  <span className="text-[10px] text-text-dim">{t("settlement.gas")}: ~0.00005 SOL</span>
                </div>
              </div>
            </div>

            {/* Action button & status */}
            <div className="flex flex-col gap-4">
              <button
                onClick={handlePayDeposit}
                disabled={paying || !wallet.publicKey || !auction}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-[0.2em] text-[#141313] shadow-[0px_0px_20px_rgba(184,165,255,0.25)] transition-all hover:bg-accent-strong disabled:opacity-50"
              >
                <SolanaIcon className="size-4" width={16} height={16} />
                {paying ? t("settlement.submitting") : t("settlement.secure")}
              </button>

              {txSuccess && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center text-xs text-green-300">
                  <div className="font-bold">{t("settlement.confirmed")}</div>
                  <div className="mt-1 font-mono text-[10px] break-all">Tx: {txSuccess}</div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-start gap-3 pt-1">
                <WarningIcon className="mt-0.5 size-4 shrink-0 text-text-dim" width={16} height={16} />
                <p className="text-xs leading-5 text-text-dim">
                  {t("settlement.rules")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettlementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <SettlementContent />
    </Suspense>
  );
}
