"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/layout/PageHero";
import { FadeUp } from "@/components/motion/Reveal";
import { fetchLiveAuctions, type Auction } from "@/lib/data";
import {
  getUserMintedArtworks,
  getHiddenMints,
  hydrateArtworksForWallet,
  type MintedArtworkRecord,
} from "@/lib/artworkCache";
import { CreateAuctionModal } from "@/components/CreateAuctionModal";
import { useI18n } from "@/lib/i18n";
import { getSavedBidSecret, getAllSavedBidsForAuction, hydrateAllBidSecrets } from "@/lib/auction-crypto";
import { Loading, Skeleton } from "@/components/ui/Loading";

export default function AuctionsPage() {
  const { t, L } = useI18n();
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  // User vault selection state
  const [userArtworks, setUserArtworks] = useState<MintedArtworkRecord[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<MintedArtworkRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSelectVaultModalOpen, setIsSelectVaultModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        await hydrateAllBidSecrets();
        const liveAuctions = await fetchLiveAuctions(connection);
        if (isMounted) setAuctions(liveAuctions);
      } catch (e) {
        console.error("Failed to load auctions:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [connection]);

  // Load user's portfolio vault artworks
  useEffect(() => {
    let isMounted = true;
    if (publicKey) {
      const walletStr = publicKey.toBase58();
      hydrateArtworksForWallet(walletStr).then(() => {
        if (!isMounted) return;
        const hidden = getHiddenMints(walletStr);
        const all = getUserMintedArtworks(walletStr);
        setUserArtworks(all.filter((item) => !hidden.includes(item.mintAddress)));
      });
    } else {
      setUserArtworks([]);
    }
    return () => {
      isMounted = false;
    };
  }, [publicKey, isCreateModalOpen]);

  function handleStartAuctionClick() {
    if (!connected) {
      setVisible(true);
      return;
    }
    setIsSelectVaultModalOpen(true);
  }

  const activeCount = auctions.filter((a) => a.isLive).length;
  const highestBidSol = auctions.reduce((max, a) => {
    const saved = getAllSavedBidsForAuction(a.id);
    const topSaved = saved.length > 0 ? saved[0].bidAmountSol : 0;
    const bid = Math.max(parseFloat(a.currentBid || "0"), topSaved, parseFloat(a.startPrice || "0"));
    return bid > max ? bid : max;
  }, 0);

  const headerStats = [
    { label: t("auctions.liveOnSolana"), value: `${activeCount} ${t("auctions.auctionCount")}${activeCount === 1 ? "" : "s"}` },
    { label: t("auctions.highestBid"), value: highestBidSol > 0 ? `${highestBidSol.toFixed(2)} SOL` : t("auctions.noBids") },
    { label: t("auctions.contractState"), value: t("auctions.verifiedActive") },
  ];

  return (
    <div id="top" className="relative flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <PageHero
          eyebrow={t("auctions.eyebrow")}
          index={L("02 / Đấu giá", "02 / Auctions")}
          lines={[L("Đấu giá", "Live"), <em key="a">{L("trực tiếp", "auctions")}</em>]}
          description={t("auctions.description")}
          actions={
            <>
              <button onClick={handleStartAuctionClick} className="btn">
                {L("Tạo đấu giá từ kho ", "Create an auction from your vault ")}<span aria-hidden>→</span>
              </button>
              <Link href="/portfolio" className="btn btn-ghost">
                {L("Kho tác phẩm", "Vault")}
              </Link>
            </>
          }
          stats={headerStats.map(({ label, value }) => ({ label, value: loading ? <Skeleton className="w-[6ch]" /> : value }))}
        />

        {loading ? (
          <Loading label={t("auctions.loading")} />
        ) : auctions.length === 0 ? (
          <section className="border border-line px-6 py-28 text-center">
            <p className="mega text-[clamp(4rem,12vw,10rem)] text-text-dim/40">00</p>
            <h2 className="mt-6 font-display text-3xl font-light tracking-[-0.03em]">{L("Chưa có phiên đấu giá", "No auctions yet")}</h2>
            <p className="mx-auto mt-3 max-w-md text-text-dim-2">
              {L("Chọn một tác phẩm độc bản từ kho cá nhân để khởi chạy phiên đấu giá on-chain đầu tiên.", "Pick a one-of-a-kind artwork from your vault to launch the first on-chain auction.")}
            </p>
            <button onClick={handleStartAuctionClick} className="btn mt-8">
              {L("Chọn tác phẩm từ kho →", "Pick an artwork from your vault →")}
            </button>
          </section>
        ) : (
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction, idx) => {
              const savedBids = getAllSavedBidsForAuction(auction.id);
              const myBid = publicKey ? getSavedBidSecret(auction.id, publicKey.toBase58()) : null;
              const effectiveHighestBid = Math.max(
                parseFloat(auction.currentBid || "0"),
                savedBids.length > 0 ? savedBids[0].bidAmountSol : 0,
                parseFloat(auction.startPrice || "0")
              ).toFixed(2);

              const nowUnix = Math.floor(Date.now() / 1000);
              const isSettled = auction.status?.toUpperCase() === "SETTLED";
              const isEnded = isSettled || !auction.isLive || (auction.endTime ? nowUnix >= auction.endTime : false);
              const state = isSettled ? "SOLD" : isEnded ? "CLOSED" : "LIVE";

              return (
                <FadeUp key={auction.id} delay={(idx % 3) * 0.08}>
                  <Link href={`/auctions/${auction.id}`} className="group block" data-cursor>
                    <div className="relative aspect-[4/5] overflow-hidden bg-bg-elevated">
                      <Image
                        src={auction.image}
                        alt={auction.title}
                        fill
                        sizes="(max-width:768px) 100vw, 33vw"
                        className={`object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07] ${
                          isEnded && !isSettled ? "grayscale" : ""
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                      <i className="reg left-3 top-3" />
                      <i className="reg right-3 top-3" />
                      <i className="reg bottom-3 left-3" />
                      <i className="reg bottom-3 right-3" />

                      <span
                        className={`absolute left-4 top-4 flex items-center gap-2 px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] backdrop-blur-sm ${
                          state === "LIVE" ? "bg-accent text-ink" : state === "SOLD" ? "bg-success text-ink" : "bg-ink/80 text-text-dim-2"
                        }`}
                      >
                        {state === "LIVE" && <span className="size-1.5 animate-pulse rounded-full bg-ink" />}
                        {state === "LIVE" ? t("auctions.liveBidding") : state === "SOLD" ? L("Đã bán", "Sold") : L("Đã kết thúc", "Ended")}
                      </span>

                      {myBid && (
                        <span className="absolute inset-x-4 bottom-4 bg-ink/85 px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text backdrop-blur-sm">
                          {isSettled ? L(`Bạn thắng · ${myBid.bidAmountSol.toFixed(2)} SOL`, `You won · ${myBid.bidAmountSol.toFixed(2)} SOL`) : L(`Bạn đang dẫn · ${myBid.bidAmountSol.toFixed(2)} SOL`, `You are leading · ${myBid.bidAmountSol.toFixed(2)} SOL`)}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 border-t border-line pt-3">
                      <span className="font-mono-ui text-[10px] tracking-[0.14em] text-text-dim">№ {String(idx + 1).padStart(2, "0")}</span>
                      <h3 className="truncate font-display text-[clamp(1.3rem,2vw,1.9rem)] font-light leading-tight tracking-[-0.03em] transition-colors duration-500 group-hover:text-accent">
                        {auction.title}
                      </h3>
                      <span className={`font-mono-ui text-sm ${state === "LIVE" ? "text-accent" : "text-text"}`}>{effectiveHighestBid} SOL</span>
                      <span />
                      <span className="eyebrow truncate">
                        {t("auctions.seller")} {auction.artist}
                      </span>
                      <span className="eyebrow text-right">{isSettled ? L("Giá chốt", "Final price") : isEnded ? L("Giá cuối", "Final bid") : t("auctions.currentBid")}</span>
                    </div>
                  </Link>
                </FadeUp>
              );
            })}
          </div>
        )}
      </main>

      {/* Select Artwork From Vault Modal */}
      {isSelectVaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#121211] p-6 text-text shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-xl text-text">
                  {L("Chọn Tác Phẩm Từ Kho Cá Nhân", "Pick an artwork from your vault")}
                </h3>
                <p className="text-xs text-text-dim">
                  {L("Chọn tác phẩm 1/1 bạn sở hữu để đưa lên sàn đấu giá on-chain", "Pick a 1/1 artwork you own to put it up for on-chain auction")}
                </p>
              </div>
              <button
                onClick={() => setIsSelectVaultModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-dim hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3">
              {userArtworks.length === 0 ? (
                <div className="py-12 text-center text-text-dim">
                  <p className="text-sm">{L("Bạn chưa có tác phẩm nào trong kho.", "You have no artworks in your vault yet.")}</p>
                  <Link
                    href="/portfolio"
                    className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase text-[#0a0a09]"
                  >
                    {L("Xem Kho Tác Phẩm", "Open vault")}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {userArtworks.map((item) => (
                    <div
                      key={item.mintAddress}
                      onClick={() => {
                        setSelectedArtwork(item);
                        setIsSelectVaultModalOpen(false);
                        setIsCreateModalOpen(true);
                      }}
                      className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-all hover:border-accent/50 hover:bg-white/[0.05]"
                    >
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-black border border-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="size-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-display text-sm text-text truncate group-hover:text-accent">
                          {item.title}
                        </h4>
                        <p className="font-mono text-[11px] text-text-dim truncate">
                          {item.mintAddress.slice(0, 6)}...{item.mintAddress.slice(-6)}
                        </p>
                        <span className="mt-1 inline-block text-[10px] font-semibold text-accent">
                          {L("Chọn tác phẩm này", "Pick this artwork")} &rarr;
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Auction Modal */}
      <CreateAuctionModal
        artwork={selectedArtwork}
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setSelectedArtwork(null);
        }}
      />

      <Footer />
    </div>
  );
}
