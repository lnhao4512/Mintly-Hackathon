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
      <div className="flex min-h-screen flex-col bg-[#0a0b0d] text-text">
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
      <div className="flex min-h-screen flex-col bg-[#0a0b0d] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <section className="rainbow-border max-w-lg rounded-[30px] bg-[rgba(18,18,18,0.72)] p-10 backdrop-blur-xl">
            <h1 className="font-display text-4xl text-text">Listing Not Found</h1>
            <p className="mt-3 text-text-dim">
              The requested account is not an active direct sale listing on-chain.
            </p>
            <Link
              href="/auctions"
              className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313]"
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
    <div className="relative flex min-h-screen flex-col bg-[#0a0b0d] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pt-32 lg:px-16">
        <div className="mb-6">
          <Link
            href="/"
            className="eyebrow text-text-dim transition-colors hover:text-accent"
          >
            &larr; Back to Explore
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Artwork Showcase */}
          <div className="lg:col-span-6">
            <div className="rainbow-border relative aspect-square w-full overflow-hidden rounded-[32px] bg-[#111315] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)]">
              <Image
                src={listing.image}
                alt={listing.title}
                fill
                priority
                sizes="(max-width:1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/60 px-3.5 py-1.5 backdrop-blur-md">
                <span className="eyebrow text-accent-strong">
                  {listing.status === "ACTIVE" ? "DIRECT SALE" : listing.status}
                </span>
              </div>
            </div>

            {/* Smart Contract Proof Details */}
            <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
              <div className="eyebrow mb-3 text-text-dim">{t("detail.provenance")}</div>
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
              <span className="eyebrow text-accent-strong">Instant Buy Artifact</span>
              <h1 className="mt-2 font-display text-4xl uppercase leading-tight text-text sm:text-5xl">
                {listing.title}
              </h1>
              <p className="mt-2 text-sm text-text-dim">
                {t("detail.createdBy")}{" "}
                <span className="font-mono text-text">{listing.artist}</span>
              </p>
            </div>

            {/* Price & Buy Now Card */}
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md">
              <div className="border-b border-white/10 pb-5">
                <div className="eyebrow text-text-dim">Direct Purchase Price</div>
                <div className="mt-1 font-display text-4xl text-text">
                  {listing.price}
                </div>
              </div>

              {/* Purchase Action */}
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={submitting || listing.status !== "ACTIVE"}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-[0.2em] text-[#141313] shadow-[0px_0px_20px_rgba(184,165,255,0.25)] transition-all hover:bg-accent-strong disabled:opacity-50"
                >
                  <SolanaIcon className="size-4" width={16} height={16} />
                  {submitting ? "Processing Purchase..." : t("card.buyNow")}
                </button>
              </div>

              {txSuccess && (
                <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300">
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
                  className="text-accent underline hover:text-accent-strong"
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
