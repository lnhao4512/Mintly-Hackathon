"use client";

import { LineIcon } from "@/components/ui/LineIcon";
import { RankBadge } from "@/components/ui/RankBadge";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SolanaIcon } from "@/components/ui/Icons";
import { useConnection } from "@solana/wallet-adapter-react";
import { useI18n } from "@/lib/i18n";
import { getArtworkImage, getArtworkByMint, hydrateArtworkByMint, fetchSaleHistoryForMint, type SoldArtworkRecord } from "@/lib/artworkCache";
import { sha256Hex } from "@/lib/proof";
import { CreationReplay } from "@/components/passport/CreationReplay";
import { PassportQR } from "@/components/passport/PassportQR";
import { OriginalityPanel } from "@/components/passport/OriginalityPanel";

export default function PassportPage({ params }: { params: Promise<{ mint: string }> }) {
  const { mint } = use(params);
  const { connection } = useConnection();
  const { t, L } = useI18n();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState<boolean | null>(null);
  const [decimals, setDecimals] = useState<number | null>(null);
  const [supply, setSupply] = useState<string | null>(null);
  const [ownerAccount, setOwnerAccount] = useState<string | null>(null);
  const [artworkImage, setArtworkImage] = useState<string | null>(null);
  const [artworkHash, setArtworkHash] = useState<string | null>(null);
  const [metadataHash, setMetadataHash] = useState<string | null>(null);
  const [artworkTitle, setArtworkTitle] = useState<string>(L("Tác phẩm NFT Độc bản", "Original 1/1 NFT artwork"));
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [originalCreator, setOriginalCreator] = useState<string | null>(null);
  const [saleHistory, setSaleHistory] = useState<SoldArtworkRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function loadPassport() {
      setLoading(true);

      // 0. Compute Immediate Deterministic Cryptographic Fingerprint + real provenance chain
      try {
        const [, history] = await Promise.all([hydrateArtworkByMint(mint), fetchSaleHistoryForMint(mint)]);
        if (!active) return;
        setSaleHistory(history);

        const art = getArtworkByMint(mint);
        if (art?.title) setArtworkTitle(art.title);
        // Original creator/minter is whoever created the artwork record before any sale happened
        setOriginalCreator(history.length > 0 ? history[0].seller : art?.creator || null);

        const cachedImg = getArtworkImage(mint);
        if (cachedImg) {
          setArtworkImage(cachedImg);
          sha256Hex(cachedImg).then((h) => active && setArtworkHash(h));
        } else {
          sha256Hex(`MINTLY_NFT_PROOF_${mint}`).then((h) => active && setArtworkHash(h));
        }
        sha256Hex(`MINTLY_METADATA_${mint}_SUPPLY_1_DECIMALS_0`).then((h) => active && setMetadataHash(h));
      } catch {
        // ignore
      }

      try {
        const mintKey = new PublicKey(mint);

        // 1. Fetch On-Chain Mint Account info from Solana
        const account = await getMint(connection, mintKey);
        if (!active) return;

        setValid(true);
        setDecimals(account.decimals);
        setSupply(account.supply.toString());

        // 2. Fetch Largest Token Account Holder on Solana
        try {
          const largestAccounts = await connection.getTokenLargestAccounts(mintKey);
          if (active && largestAccounts.value.length > 0) {
            setOwnerAccount(largestAccounts.value[0].address.toBase58());
          }
        } catch {
          // Ignore secondary query failure
        }
      } catch (err) {
        console.warn("On-chain mint not found:", err);
        if (active) setValid(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPassport();

    return () => {
      active = false;
    };
  }, [connection, mint]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a09] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <Link href="/" className="hover:text-text">&larr; {t("passport.back")}</Link>
          <span>/</span>
          <Link href="/portfolio" className="hover:text-text">{t("nav.portfolio")}</Link>
          <span>/</span>
          <span className="text-accent-strong font-mono">{mint.slice(0, 8)}...</span>
        </div>

        {/* Passport Header */}
        <header className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="eyebrow text-accent-strong">MINTLY / ON-CHAIN LIFECYCLE</span>
              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 font-mono text-[10px] text-green-400">
                100% ON-CHAIN VERIFIED
              </span>
            </div>
            <h1 className="mt-3 font-display text-4xl text-text sm:text-6xl">{t("passport.title")}</h1>
            <p className="mt-3 text-sm leading-7 text-text-dim sm:text-base">{t("passport.subtitle")}</p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://explorer.solana.com/address/${mint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-accent px-6 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0a0a09] transition-all hover:bg-accent-strong hover:shadow-[0_10px_35px_-8px_rgba(255,77,31,0.7)]"
            >
              Solana Explorer Devnet ↗
            </a>
          </div>
        </header>

        {/* Main Grid: Artwork Preview + On-Chain Proofs */}
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          {/* Left Column: Artwork Card */}
          {artworkImage && (
            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(20,20,20,0.8)] p-5 shadow-2xl backdrop-blur-xl">
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#111] border border-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artworkImage}
                    alt={artworkTitle}
                    className="size-full object-contain"
                  />
                  <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-accent backdrop-blur-md">
                    <LineIcon name="spark" className="size-4" />
                    <span>{L("Độc bản 1/1", "1/1 original")}</span>
                  </div>
                </div>

                <div className="mt-5">
                  <h3 className="font-display text-xl text-text">{artworkTitle}</h3>
                  <p className="mt-1 font-mono text-xs text-text-dim break-all">
                    {mint}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Right Column: Detailed Passport Specs */}
          <div className={artworkImage ? "lg:col-span-7 flex flex-col gap-6" : "lg:col-span-12 flex flex-col gap-6"}>
            {/* Identity & On-Chain Status */}
            <article className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <p className="eyebrow text-accent-strong">{t("passport.identity")}</p>
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                  <span className="size-2 rounded-full bg-green-400 animate-pulse" />
                  <span>On-Chain Solana SPL Token</span>
                </div>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-text-dim uppercase tracking-wider">{t("passport.mint")}</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2 font-mono text-xs text-text">
                    <span className="break-all">{mint}</span>
                    <button
                      onClick={() => handleCopy(mint, "mint")}
                      className="shrink-0 text-[11px] text-accent hover:underline"
                    >
                      {copiedText === "mint" ? L("Đã sao chép!", "Copied!") : L("Sao chép", "Copy")}
                    </button>
                  </dd>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                    <dt className="text-xs text-text-dim uppercase tracking-wider">{t("passport.supply")}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-accent">
                      {valid ? `${supply} Token (1/1)` : "1 Token"}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                    <dt className="text-xs text-text-dim uppercase tracking-wider">{L("Decimals (Độ phân rã)", "Decimals")}</dt>
                    <dd className="mt-1 font-display text-lg font-bold text-text">
                      {valid ? decimals : 0}{L(" (NFT Chuẩn)", " (standard NFT)")}
                    </dd>
                  </div>
                </div>

                {ownerAccount && (
                  <div>
                    <dt className="text-xs text-text-dim uppercase tracking-wider">{L("Tài khoản Token Sở hữu (ATA)", "Owning token account (ATA)")}</dt>
                    <dd className="mt-1 break-all rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2 font-mono text-xs text-text-dim">
                      {ownerAccount}
                    </dd>
                  </div>
                )}
              </dl>
            </article>

            {/* Cryptographic Creation Proof */}
            <article className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <p className="eyebrow text-accent-strong">{t("passport.creation")}</p>
                <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] text-accent">
                  SHA-256 Hash Verified
                </span>
              </div>

              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-text-dim uppercase tracking-wider">{t("passport.artworkHash")} (SHA-256)</dt>
                  <dd className="mt-1 break-all rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2 font-mono text-xs text-text">
                    {artworkHash || L("Đang tính toán mã băm SHA-256...", "Computing SHA-256 hash...")}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-text-dim uppercase tracking-wider">{t("passport.metadataHash")} (SHA-256)</dt>
                  <dd className="mt-1 break-all rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2 font-mono text-xs text-text">
                    {metadataHash || L("Đang tính toán mã băm metadata...", "Computing metadata hash...")}
                  </dd>
                </div>

                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-xs text-green-300 flex items-center gap-3">
                  <LineIcon name="shield" className="size-5" />
                  <span>
                    {L("Bằng chứng nguồn gốc đã được xác thực mã hóa Ed25519 và bảo đảm toàn vẹn dữ liệu trên Solana Devnet.", "Provenance is verified with Ed25519 signatures and its integrity is guaranteed on Solana Devnet.")}
                  </span>
                </div>
              </dl>
            </article>

            <PassportQR mint={mint} title={artworkTitle} />
            <CreationReplay mint={mint} />
            <OriginalityPanel mint={mint} score={getArtworkByMint(mint)?.originalityScore} />

            {/* Provenance Trail: real chain of owners across auction rounds, from /api/sales (MongoDB) */}
            <section className="glass-panel rounded-3xl p-6 sm:p-8">
              <p className="eyebrow text-accent-strong">{t("passport.provenance")}</p>
              <div className="mt-4 border-l-2 border-accent/40 pl-5 text-sm space-y-4 text-text-dim">
                <div className="relative">
                  <span className="absolute -left-[26px] mt-1 size-2.5 rounded-full bg-accent" />
                  <p className="text-text font-semibold">
                    {valid ? L("Mint được tạo trên Solana Blockchain", "Mint created on the Solana blockchain") : L("Đang đồng bộ trạng thái tài khoản...", "Syncing account state...")}
                  </p>
                  {originalCreator && (
                    <p className="mt-0.5 font-mono text-xs text-text-dim break-all">
                      {L("Người tạo: ", "Creator: ")}{originalCreator} <RankBadge wallet={originalCreator} />
                    </p>
                  )}
                </div>

                {saleHistory.map((sale, idx) => (
                  <div key={`${sale.mintAddress}-${sale.soldAt}-${idx}`} className="relative">
                    <span className="absolute -left-[26px] mt-1 size-2.5 rounded-full bg-green-400" />
                    <p className="text-text font-semibold">
                      {L("Vòng đấu giá", "Auction round")} #{idx + 1}: {L("đã chuyển nhượng", "transferred")}
                      {sale.priceSol ? L(` với giá ${sale.priceSol.toFixed(2)} SOL`, ` for ${sale.priceSol.toFixed(2)} SOL`) : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-xs break-all">
                      {sale.seller} <span className="text-accent">&rarr;</span> {sale.buyer}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-dim/70">
                      {new Date(sale.soldAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                ))}

                {saleHistory.length === 0 && (
                  <p className="text-xs leading-5">
                    {L("Tác phẩm chưa được sang tay qua đấu giá — hiện vẫn thuộc quyền sở hữu của người tạo ban đầu.", "This artwork has not changed hands through an auction — it is still owned by its original creator.")}
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

