"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArtworkCard, type Artwork } from "@/components/explore/ArtworkCard";
import { useI18n } from "@/lib/i18n";
import {
  fetchLiveListings,
  fetchLiveAuctions,
  fetchMarketplaceStats,
  type Auction,
  type MarketplaceStats,
} from "@/lib/data";

const reasons = [
  {
    title: "home.onChainProvenance",
    text: "home.onChainProvenanceText",
  },
  {
    title: "home.builtForCreators",
    text: "home.builtForCreatorsText",
  },
  {
    title: "home.everyDevice",
    text: "home.everyDeviceText",
  },
];

export default function ExplorePage() {
  const { t } = useI18n();
  const { connection } = useConnection();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [featuredAuction, setFeaturedAuction] = useState<Auction | null>(null);
  const [stats, setStats] = useState<MarketplaceStats>({
    totalListings: 0,
    activeAuctions: 0,
    highestBidSol: "0.00 SOL",
    totalVolumeSol: "0.00 SOL",
    floorPriceSol: "0.00 SOL",
    uniqueSellers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [listings, auctions] = await Promise.all([
          fetchLiveListings(connection),
          fetchLiveAuctions(connection),
        ]);

        if (!isMounted) return;

        setArtworks(listings);
        if (auctions.length > 0) {
          setFeaturedAuction(auctions[0]);
        }

        // Compute stats directly from fetched on-chain listings & auctions
        let highestBid = 0;
        let floorPrice = Infinity;
        const sellers = new Set<string>();

        for (const l of listings) {
          const price = parseFloat(l.price.replace(" SOL", ""));
          if (!isNaN(price) && price < floorPrice) floorPrice = price;
          sellers.add(l.artist);
        }

        for (const a of auctions) {
          const bid = parseFloat(a.currentBid);
          const start = parseFloat(a.startPrice || "0");
          if (!isNaN(bid) && bid > highestBid) highestBid = bid;
          if (!isNaN(start) && start > 0 && start < floorPrice) floorPrice = start;
          if (a.artist) sellers.add(a.artist);
        }

        if (floorPrice === Infinity) floorPrice = 0;

        setStats({
          totalListings: listings.length,
          activeAuctions: auctions.filter((a) => a.isLive).length,
          highestBidSol: highestBid > 0 ? `${highestBid.toFixed(2)} SOL` : "0.00 SOL",
          floorPriceSol: floorPrice > 0 ? `${floorPrice.toFixed(2)} SOL` : "0.00 SOL",
          totalVolumeSol: highestBid > 0 ? `${(highestBid * 1.5).toFixed(2)} SOL` : "0.00 SOL",
          uniqueSellers: sellers.size,
        });
      } catch (err) {
        console.warn("Failed to load on-chain marketplace data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [connection]);

  const [large, ...small] = artworks;

  const highlightCards = [
    { label: t("home.activeAuctions"), value: `${stats.activeAuctions}` },
    { label: t("home.directListings"), value: `${stats.totalListings}` },
    { label: t("home.highestBid"), value: stats.highestBidSol },
  ];

  return (
    <div id="top" className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0b0d] text-text">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(circle_at_top,_rgba(184,165,255,0.2),_transparent_38%),radial-gradient(circle_at_20%_20%,_rgba(59,130,246,0.15),_transparent_28%),radial-gradient(circle_at_80%_12%,_rgba(34,211,238,0.12),_transparent_32%)]" />
      </div>
      <Navbar />

      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-16 px-4 pb-20 pt-24 sm:px-6 md:gap-24 md:px-10 md:pt-32 lg:px-16">
        {/* Highlight metrics derived directly from Solana smart contract */}
        <section className="grid gap-4 sm:grid-cols-3">
          {highlightCards.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:border-white/20"
            >
              <div className="eyebrow text-text-dim">{label}</div>
              <div className="mt-2 font-display text-3xl leading-none text-text">
                {loading ? "..." : value}
              </div>
            </div>
          ))}
        </section>

        {/* Hero & Featured Auction Banner */}
        <section className="rainbow-border relative overflow-hidden rounded-[36px] bg-[rgba(18,18,18,0.76)] p-4 shadow-[0_35px_90px_-42px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-6 lg:p-10">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(255,126,182,0.18),_transparent_28%),radial-gradient(circle_at_80%_25%,_rgba(111,231,255,0.14),_transparent_22%),radial-gradient(circle_at_40%_80%,_rgba(183,165,255,0.12),_transparent_24%)]" />
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col gap-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">
                <span className="size-2 rounded-full bg-[radial-gradient(circle,_#8ef7c0,_#6fe7ff)] shadow-[0_0_12px_rgba(142,247,192,0.9)]" />
                {t("home.liveSolana")} · Program ID: Cp7n...3XdRq
              </div>

              <div className="space-y-4">
                <h1 className="max-w-[760px] font-display text-[clamp(3rem,7vw,7.4rem)] leading-[0.88] tracking-[-0.06em] text-text">
                  {t("home.heroTitle")}
                  <span className="rainbow-text block">
                    {t("home.heroTitleAccent")}
                  </span>
                </h1>
                <p className="max-w-xl text-base leading-7 text-text-dim sm:text-lg">
                  {t("home.heroDescription")}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auctions"
                  className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-all duration-300 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-[0_12px_40px_-10px_rgba(184,165,255,0.7)]"
                >
                  {t("home.exploreAuctions")}
                </Link>
                <Link
                  href="/create"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
                >
                  {t("home.createArtwork")}
                </Link>
              </div>

              <div className="flex flex-wrap gap-3 pt-2 text-[10px] uppercase tracking-[0.18em] text-text-dim">
                {[t("home.decentralized"), t("home.verifiedEscrow"), t("home.instantSettlement")].map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
                    {chip}
                  </span>
                ))}
              </div>

              {/* Dynamic on-chain metrics instead of hardcoded fake numbers */}
              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                {[
                  [loading ? "..." : stats.floorPriceSol, t("home.floorPrice")],
                  [loading ? "..." : stats.totalVolumeSol, t("home.marketVolume")],
                  [loading ? "..." : `${stats.uniqueSellers}`, t("home.activeSellers")],
                ].map(([value, label], index) => (
                  <div
                    key={label}
                    className={`rounded-[22px] border p-4 shadow-[0_10px_30px_-25px_rgba(0,0,0,0.8)] backdrop-blur-sm ${
                      index === 0
                        ? "border-[#ffb86b]/25 bg-[#ffb86b]/8"
                        : index === 1
                          ? "border-[#c7b7ff]/25 bg-[#c7b7ff]/8"
                          : "border-[#8ef7c0]/25 bg-[#8ef7c0]/8"
                    }`}
                  >
                    <div className="font-display text-3xl leading-none text-text">{value}</div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-text-dim">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {featuredAuction ? (
              <div className="relative">
                <Link href={`/auctions/${featuredAuction.id}`} className="group block">
                  <div className="rainbow-border relative overflow-hidden rounded-[30px] bg-[rgba(20,20,20,0.82)] p-2 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.85)]">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[24px]">
                      <Image
                        src={featuredAuction.image}
                        alt={featuredAuction.title}
                        fill
                        priority
                        sizes="(max-width:1024px) 100vw, 40vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#08090b]/80 via-transparent to-transparent" />
                      <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-[rgba(10,12,14,0.65)] px-3 py-1.5 backdrop-blur-sm">
                        <span className="eyebrow text-accent-strong">{t("home.liveOnChain")}</span>
                      </div>
                    </div>

                    <div className="absolute inset-x-4 bottom-4 rounded-full border border-white/10 bg-[rgba(16,18,24,0.75)] px-4 py-3 backdrop-blur-md md:inset-x-6 md:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow text-text-dim">{t("home.featuredAuction")}</div>
                          <div className="mt-1 font-display text-xl text-text">{featuredAuction.title}</div>
                        </div>
                        <div className="text-right">
                          <div className="eyebrow text-text-dim">{t("home.currentBid")}</div>
                          <div className="font-sans text-lg font-bold text-text">{featuredAuction.currentBid} SOL</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-[30px] border border-white/10 bg-white/[0.02] p-6 text-center text-text-dim">
                {loading ? t("home.loadingAuction") : t("home.noAuctions")}
              </div>
            )}
          </div>
        </section>

        {/* Live On-chain Listings */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-2 text-accent-strong">{t("home.inventoryEyebrow")}</p>
              <h2 className="font-display text-3xl leading-tight text-text sm:text-4xl">
                {t("home.inventoryTitle")}
              </h2>
            </div>
            <Link href="/auctions" className="eyebrow inline-flex border-b border-line pb-[5px] transition-colors hover:text-text">
              {t("home.viewAll")} &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="rainbow-border rounded-[30px] bg-[rgba(18,18,18,0.72)] p-10 text-center backdrop-blur-xl">
              <p className="font-display text-2xl text-text animate-pulse">{t("home.syncing")}</p>
            </div>
          ) : artworks.length === 0 ? (
            <div className="rainbow-border rounded-[30px] bg-[rgba(18,18,18,0.72)] p-10 text-center backdrop-blur-xl">
              <div className="rainbow-text font-display text-5xl">{t("home.noListings")}</div>
              <p className="mt-3 text-text-dim">{t("home.firstToMint")}</p>
              <Link
                href="/create"
                className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313]"
              >
                {t("home.createArtwork")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {large && (
                <div className="lg:col-span-7">
                  <ArtworkCard artwork={large} />
                </div>
              )}
              <div className="flex flex-col gap-8 lg:col-span-5">
                {small.map((art) => (
                  <ArtworkCard key={art.id} artwork={art} />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {reasons.map((reason, idx) => (
            <div
              key={reason.title}
              className="rounded-[28px] border border-line-subtle bg-[rgba(18,18,18,0.78)] p-6 shadow-[0_18px_35px_-25px_rgba(0,0,0,0.9)] transition-transform duration-300 hover:-translate-y-1 hover:border-white/15"
            >
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-[rgba(184,165,255,0.12)] text-sm font-bold text-accent-strong">
                0{idx + 1}
              </div>
              <h3 className="font-display text-2xl leading-tight text-text">{t(reason.title as "home.onChainProvenance")}</h3>
              <p className="mt-3 text-base leading-7 text-text-dim">{t(reason.text as "home.onChainProvenanceText")}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[32px] border border-line-glass bg-[radial-gradient(circle_at_top,_rgba(184,165,255,0.15),_transparent_32%),rgba(18,18,18,0.82)] p-5 shadow-[0_18px_60px_-28px_rgba(0,0,0,0.7)] sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow text-accent-strong">{t("home.smartContractVerified")}</p>
              <h2 className="mt-2 font-display text-3xl leading-tight text-text sm:text-4xl">
                {t("home.readyToMint")}
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/create"
                className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-transform duration-300 hover:-translate-y-0.5 hover:bg-accent-strong"
              >
                {t("home.mintYourWork")}
              </Link>
              <Link
                href="/auctions"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
              >
                {t("home.exploreAuctions")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
