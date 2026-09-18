"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchLiveAuctions, type Auction } from "@/lib/data";
import {
  getUserMintedArtworks,
  getHiddenMints,
  type MintedArtworkRecord,
} from "@/lib/artworkCache";
import { CreateAuctionModal } from "@/components/CreateAuctionModal";
import { useI18n } from "@/lib/i18n";
import { getSavedBidSecret, getAllSavedBidsForAuction } from "@/lib/auction-crypto";

export default function AuctionsPage() {
  const { t } = useI18n();
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
    if (publicKey) {
      const hidden = getHiddenMints(publicKey.toBase58());
      const all = getUserMintedArtworks(publicKey.toBase58());
      setUserArtworks(all.filter((item) => !hidden.includes(item.mintAddress)));
    } else {
      setUserArtworks([]);
    }
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
    <div id="top" className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0b0d] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-24 sm:px-6 md:px-10 md:pt-32 lg:px-16">
        <header className="mb-10 flex flex-col justify-between gap-6 md:mb-14 md:flex-row md:items-end">
          <div>
            <span className="eyebrow text-accent-strong">{t("auctions.eyebrow")}</span>
            <h1 className="font-display font-normal uppercase leading-[0.92] tracking-[-0.05em] text-text [font-size:clamp(2.5rem,6vw,5.4rem)]">
              {t("auctions.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-text-dim">
              {t("auctions.description")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStartAuctionClick}
              className="flex items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_35px_-5px_rgba(184,165,255,0.7)]"
            >
              <span>🔨</span>
              <span>Tạo Đấu Giá Từ Kho Tác Phẩm</span>
            </button>

            <Link
              href="/portfolio"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3.5 text-xs font-semibold text-text-dim transition-all hover:bg-white/10 hover:text-white"
            >
              Vào Kho Tác Phẩm ↗
            </Link>
          </div>
        </header>

        {/* Real dynamic metrics */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {headerStats.map(({ label, value }) => (
            <div key={label} className="rounded-[22px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="eyebrow text-text-dim">{label}</div>
              <div className="mt-2 font-display text-2xl text-text">
                {loading ? "..." : value}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rainbow-border flex min-h-[360px] items-center justify-center rounded-[30px] bg-[rgba(18,18,18,0.72)] p-8 text-center backdrop-blur-xl">
            <p className="font-display text-2xl text-text animate-pulse">{t("auctions.loading")}</p>
          </div>
        ) : auctions.length === 0 ? (
          <section className="rainbow-border flex min-h-[360px] items-center justify-center rounded-[30px] bg-[rgba(18,18,18,0.72)] p-8 text-center backdrop-blur-xl">
            <div className="max-w-lg">
              <div className="rainbow-text font-display text-6xl leading-none">00</div>
              <h2 className="mt-5 font-display text-3xl text-text">Chưa có phiên đấu giá</h2>
              <p className="mt-3 text-base leading-7 text-text-dim">
                Hãy chọn một tác phẩm độc bản từ kho cá nhân của bạn để khởi chạy phiên đấu giá on-chain đầu tiên!
              </p>
              
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={handleStartAuctionClick}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-xs font-bold uppercase tracking-[0.15em] text-[#141313] transition-all hover:bg-accent-strong hover:shadow-[0_10px_35px_-5px_rgba(184,165,255,0.7)]"
                >
                  <span>🔨</span>
                  <span>Chọn Tác Phẩm Từ Kho Đem Đi Đấu Giá</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((auction) => {
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

              return (
                <Link
                  key={auction.id}
                  href={`/auctions/${auction.id}`}
                  className="group block"
                >
                  <div className={`rainbow-border relative w-full overflow-hidden rounded-[30px] bg-[#111315] transition-all duration-300 group-hover:-translate-y-1 aspect-[4/3] ${
                    isSettled
                      ? "opacity-85 ring-2 ring-green-500/40 shadow-[0_0_25px_rgba(74,222,128,0.2)]"
                      : isEnded
                      ? "opacity-75 grayscale-[0.25] hover:opacity-100 hover:grayscale-0"
                      : myBid
                      ? "ring-2 ring-accent shadow-[0_0_30px_rgba(184,165,255,0.25)]"
                      : ""
                  }`}>
                    <Image
                      src={auction.image}
                      alt={auction.title}
                      fill
                      sizes="(max-width:768px) 100vw, 33vw"
                      className={`object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] ${
                        isEnded && !isSettled ? "grayscale-[0.3]" : ""
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090b0d]/90 via-[#090b0d]/30 to-transparent" />

                    <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
                      <span className={`rounded-full border px-3 py-1 backdrop-blur-sm ${
                        isSettled
                          ? "border-green-500/30 bg-green-950/70"
                          : isEnded
                          ? "border-white/20 bg-black/70"
                          : "border-[#d9d0ff]/20 bg-[#12131a]/70"
                      }`}>
                        <span className={`eyebrow ${
                          isSettled
                            ? "text-green-300"
                            : isEnded
                            ? "text-text-dim"
                            : "text-accent-strong"
                        }`}>
                          {isSettled ? "🏆 ĐÃ THÀNH CÔNG" : isEnded ? "🏁 ĐÃ KẾT THÚC" : t("auctions.liveBidding")}
                        </span>
                      </span>
                      <span className="rounded-full border border-[#8ef7c0]/30 bg-[#8ef7c0]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#8ef7c0]">
                        {t("auctions.escrow")}
                      </span>
                    </div>

                    {/* Active User Bid Badge */}
                    {myBid && (
                      <div className="absolute inset-x-4 top-14 flex items-center gap-1.5">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
                          isSettled
                            ? "border-green-500/50 bg-green-950/80 text-green-300"
                            : isEnded
                            ? "border-white/20 bg-black/80 text-text-dim"
                            : "border-accent/50 bg-black/80 text-accent shadow-[0_0_20px_rgba(184,165,255,0.4)]"
                        }`}>
                          <span>{isSettled ? "🏆" : "🎯"}</span>
                          <span>{isSettled ? `Đã Thắng: ${myBid.bidAmountSol.toFixed(2)} SOL` : `Bạn Đang Đấu Giá: ${myBid.bidAmountSol.toFixed(2)} SOL`}</span>
                        </span>
                      </div>
                    )}

                    {/* Center Ended / Settled Banner */}
                    {isSettled ? (
                      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl border border-green-500/40 bg-green-950/90 p-2.5 text-center text-xs font-bold text-green-300 backdrop-blur-md shadow-2xl">
                        🎉 ĐÃ ĐẤU GIÁ THÀNH CÔNG
                      </div>
                    ) : isEnded ? (
                      <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-black/85 p-2.5 text-center text-xs font-bold text-text-dim backdrop-blur-md shadow-2xl">
                        🏁 PHIÊN ĐẤU GIÁ ĐÃ KẾT THÚC
                      </div>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                      <div>
                        <div className="font-display text-xl leading-none text-text sm:text-2xl">
                          {auction.title}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-text-dim">
                          {t("auctions.seller")}: {auction.artist}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-sans text-lg font-semibold ${isSettled ? "text-green-300" : isEnded ? "text-text-dim" : "text-accent"}`}>
                          {effectiveHighestBid} SOL
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim">
                          {isSettled ? "Giá Chốt Deal" : isEnded ? "Giá Cuối Cùng" : t("auctions.currentBid")}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Select Artwork From Vault Modal */}
      {isSelectVaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#121316] p-6 text-text shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-display text-xl text-text">
                  Chọn Tác Phẩm Từ Kho Cá Nhân
                </h3>
                <p className="text-xs text-text-dim">
                  Chọn tác phẩm 1/1 bạn sở hữu để đưa lên sàn đấu giá on-chain
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
                  <p className="text-sm">Bạn chưa có tác phẩm nào trong kho.</p>
                  <Link
                    href="/portfolio"
                    className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase text-[#0a0a0a]"
                  >
                    Xem Kho Tác Phẩm
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
                          Chọn tác phẩm này &rarr;
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
