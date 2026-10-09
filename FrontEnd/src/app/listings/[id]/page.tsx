"use client";

import { useEffect, useState, useCallback, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchListingById, type DirectListing } from "@/lib/data";
import { buyListingOnChain } from "@/lib/marketplace";
import { MARKETPLACE_FEE_BPS } from "@/lib/config";
import { markArtworkAsSold } from "@/lib/artworkCache";
import { useI18n } from "@/lib/i18n";
import { SolanaIcon } from "@/components/ui/Icons";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useI18n();
  const { id } = use(params);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [listing, setListing] = useState<DirectListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadListingData = useCallback(async () => {
    try {
      const data = await fetchListingById(connection, id);
      setListing(data);
    } catch (e) {
      console.error("Failed to load listing detail:", e);
    } finally {
      setLoading(false);
    }
  }, [connection, id]);

  useEffect(() => {
    loadListingData();
    const interval = setInterval(loadListingData, 30000);
    return () => clearInterval(interval);
  }, [loadListingData]);

  async function handleBuyNow() {
    if (!wallet.publicKey || !wallet.signTransaction || !listing) {
      setErrorMsg(t("nav.connect"));
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setTxSuccess(null);

    try {
      const listingPda = new PublicKey(listing.id);
      const nftMint = new PublicKey(listing.nftMint);
      const seller = new PublicKey(listing.seller);

      const signature = await buyListingOnChain(
        connection,
        wallet,
        listingPda,
        nftMint,
        seller,
        listing.priceLamports
      );

      setTxSuccess(signature);
      markArtworkAsSold({
        mintAddress: listing.nftMint,
        seller: listing.seller,
        buyer: wallet.publicKey.toBase58(),
        soldAt: Date.now(),
        priceSol: listing.priceLamports / 1e9,
      });
      await loadListingData();
    } catch (err: unknown) {
      console.error("Buy listing error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a09] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center py-32">
          <p className="font-display text-2xl animate-pulse">{t("common.loading")}</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a09] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <section className="rainbow-border max-w-lg rounded-[30px] bg-[rgba(18,18,18,0.72)] p-10 backdrop-blur-xl">
            <h1 className="font-display text-4xl text-text">Listing Not Found</h1>
            <p className="mt-3 text-text-dim">
              The requested account is not an active direct sale listing on-chain.
            </p>
            <Link
              href="/auctions"
              className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a09]"
            >
              {t("detail.backAuctions")}
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a09] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pt-32 lg:px-16">
        <div className="mb-6">
          <Link
            href="/"
            className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-accent"
          >
            &larr; Back to Explore
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Artwork Showcase */}
          <div className="lg:col-span-6">
            <div className="relative aspect-square w-full overflow-hidden rounded-[32px] border border-line bg-bg-elevated shadow-[0_30px_90px_-48px_rgba(15,23,42,0.55)]">
              <Image
                src={listing.image}
                alt={listing.title}
                fill
                priority
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent" />
              <div className="absolute left-5 top-5 rounded-full border border-line bg-ink/85 px-3.5 py-1.5 backdrop-blur-md">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                  {listing.status === "ACTIVE" ? "DIRECT SALE" : listing.status}
                </span>
              </div>
            </div>

            {/* Smart Contract Proof Details */}
            <div className="mt-6 rounded-[24px] border border-line bg-bg-elevated p-5 shadow-[0_18px_60px_-45px_rgba(15,23,42,0.45)]">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">{t("detail.provenance")}</div>
              <div className="space-y-2 text-xs font-mono text-text-dim">
                <div className="flex justify-between">
                  <span>Listing PDA:</span>
                  <span className="text-text">{listing.id.slice(0, 8)}...{listing.id.slice(-8)}</span>
                </div>
                {listing.nftMint && (
                  <div className="flex justify-between">
                    <span>{t("detail.nftMint")}:</span>
                    <span className="text-text">{listing.nftMint.slice(0, 8)}...{listing.nftMint.slice(-8)}</span>
                  </div>
                )}
                {listing.seller && (
                  <div className="flex justify-between">
                    <span>{t("auctions.seller")}:</span>
                    <span className="text-text">{listing.seller.slice(0, 8)}...{listing.seller.slice(-8)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Listing Info & Instant Purchase */}
          <div className="flex flex-col gap-6 lg:col-span-6">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">Instant Buy Artifact</span>
              <h1 className="mt-2 mega text-[clamp(2.8rem,6vw,5.6rem)] !leading-[0.92] text-text">
                {listing.title}
              </h1>
              <p className="mt-2 text-sm text-text-dim">
                {t("detail.createdBy")}{" "}
                <span className="font-mono text-text">{listing.artist}</span>
              </p>
            </div>

            {/* Price & Buy Now Card */}
            <div className="rounded-[28px] border border-line bg-bg-elevated p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.55)]">
              <div className="border-b border-line pb-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">Direct Purchase Price</div>
                <div className="mt-1 font-display text-4xl text-text">
                  {listing.price}
                </div>
                <div className="mt-4 grid gap-3 rounded-2xl bg-accent/10 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-accent">Phí app 5%</div>
                    <div className="mt-1 font-mono font-bold text-text">
                      {((listing.priceLamports / 1e9) * MARKETPLACE_FEE_BPS / 10_000).toFixed(3)} SOL
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-accent">Seller nhận</div>
                    <div className="mt-1 font-mono font-bold text-text">
                      {((listing.priceLamports / 1e9) * (1 - MARKETPLACE_FEE_BPS / 10_000)).toFixed(3)} SOL
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Action */}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={submitting || listing.status !== "ACTIVE" || wallet.publicKey?.toBase58() === listing.seller}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent text-ink py-4 text-xs font-bold uppercase tracking-[0.2em] shadow-[0px_18px_50px_-28px_rgba(15,23,42,0.8)] transition-all hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <SolanaIcon className="size-4" width={16} height={16} />
                  {submitting ? "Processing Purchase..." : t("card.buyNow")}
                </button>
              </div>

              {txSuccess && (
                <div className="mt-4 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success">
                  Purchase confirmed on Solana! Tx:{" "}
                  <span className="font-mono">{txSuccess.slice(0, 16)}...</span>
                </div>
              )}

              {errorMsg && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {errorMsg}
                </div>
              )}

              <div className="mt-4 flex justify-between text-[11px] text-text-dim">
                <span>{t("detail.escrowText")}</span>
                <Link
                  href={`/passport/${encodeURIComponent(listing.nftMint)}`}
                  className="text-accent underline hover:text-accent"
                >
                  View Passport &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
