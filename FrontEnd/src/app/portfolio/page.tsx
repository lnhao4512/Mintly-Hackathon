"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SolanaIcon, DotsIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  getUserMintedArtworks,
  getArtworkImage,
  getArtworkByMint,
  deleteMintedArtwork,
  unhideArtwork,
  getHiddenMints,
  isArtworkSoldBySeller,
  isAuctionSettled,
  getWonArtworksForBuyer,
  type MintedArtworkRecord,
} from "@/lib/artworkCache";
import { CreateAuctionModal } from "@/components/CreateAuctionModal";
import { getUserActiveBids, getAllSavedBidsForAuction, type SavedBidSecret } from "@/lib/auction-crypto";
import { fetchAuctionById, fetchLiveAuctions, type Auction } from "@/lib/data";

export default function PortfolioPage() {
  const { t } = useI18n();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [artworks, setArtworks] = useState<MintedArtworkRecord[]>([]);
  const [allLiveAuctions, setAllLiveAuctions] = useState<Auction[]>([]);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "bidding">("all");
  const [myActiveBids, setMyActiveBids] = useState<SavedBidSecret[]>([]);
  const [auctionMap, setAuctionMap] = useState<Record<string, Auction>>({});
  const [isLoadingOnChain, setIsLoadingOnChain] = useState<boolean>(true);
  const [selectedArtworkForAuction, setSelectedArtworkForAuction] = useState<MintedArtworkRecord | null>(null);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);

  useEffect(() => {
    if (!publicKey || !connection) {
      setArtworks([]);
      setIsLoadingOnChain(false);
      return;
    }

    let isMounted = true;
    setIsLoadingOnChain(true);

    const walletKey = publicKey;
    const walletStr = walletKey.toBase58();

    // Auto-unhide any artworks won / purchased by this wallet
    const wonArtworks = getWonArtworksForBuyer(walletStr);
    wonArtworks.forEach((w) => unhideArtwork(w.mintAddress, walletStr));

    const freshHiddenMints = getHiddenMints(walletStr);
    const localList = getUserMintedArtworks(walletStr).filter(
      (item) => !freshHiddenMints.includes(item.mintAddress) && !isArtworkSoldBySeller(item.mintAddress, walletStr)
    );

    // Initial load from local cache
    setArtworks(localList);

    // Fetch user's active bids
    const bids = getUserActiveBids(walletStr);
    setMyActiveBids(bids);

    // Fetch live & ended auctions across the platform
    fetchLiveAuctions(connection).then((allAuctions) => {
      if (!isMounted) return;
      setAllLiveAuctions(allAuctions);

      // Build auction map from fetched auctions without extra RPC spam
      const map: Record<string, Auction> = {};
      allAuctions.forEach((a) => {
        map[a.id] = a;
        if (a.nftMint) map[a.nftMint] = a;
      });
      setAuctionMap((prev) => ({ ...prev, ...map }));

      // Filter out only auctions where current wallet is the SELLER and has actually sold the NFT
      const settledSoldMints = allAuctions
        .filter(
          (a) =>
            a.nftMint &&
            isArtworkSoldBySeller(a.nftMint, walletStr)
        )
        .map((a) => a.nftMint)
        .filter(Boolean) as string[];

      if (settledSoldMints.length > 0) {
        settledSoldMints.forEach((m) => deleteMintedArtwork(m, walletStr));
        setArtworks((prev) =>
          prev.filter((item) => !settledSoldMints.includes(item.mintAddress) && !isArtworkSoldBySeller(item.mintAddress, walletStr))
        );
      }
    }).catch(() => {});

    // Fetch SOL balance
    connection.getBalance(walletKey).then((bal) => {
      if (isMounted) setSolBalance(bal / 1e9);
    }).catch(() => {});

    // Query on-chain token accounts owned by the wallet
    async function scanOnChainTokens() {
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletKey, {
          programId: TOKEN_PROGRAM_ID,
        });

        if (!isMounted) return;

        const onChainMints: MintedArtworkRecord[] = [];

        for (const item of tokenAccounts.value) {
          const parsedInfo = item.account.data.parsed?.info;
          if (!parsedInfo) continue;

          const mint = parsedInfo.mint as string;
          const tokenAmount = parsedInfo.tokenAmount;
          const decimals = tokenAmount?.decimals;
          const amount = tokenAmount?.amount;

          // Skip if no tokens in this ATA (e.g. transferred or in escrow)
          if (!amount || amount === "0" || tokenAmount?.uiAmount === 0) continue;

          // Check if hidden or sold by this seller
          if (freshHiddenMints.includes(mint) || isArtworkSoldBySeller(mint, walletStr)) continue;

          // NFT 1/1 condition (0 decimals)
          if (decimals === 0) {
            const existsLocally = localList.some((x) => x.mintAddress === mint);
            if (existsLocally) continue;

            const existingArt = getArtworkByMint(mint);
            const cachedImage = getArtworkImage(mint) || existingArt?.imageUrl || "/assets/messi-symphony.svg";

            onChainMints.push({
              mintAddress: mint,
              title: existingArt?.title || `Tác phẩm Mint #${mint.slice(0, 4)}`,
              description: existingArt?.description || "Tác phẩm NFT đã được thanh toán & ghi nhận quyền sở hữu on-chain trên ví của bạn.",
              imageUrl: cachedImage,
              creator: existingArt?.creator || walletStr,
              createdAt: existingArt?.createdAt || Date.now() - 600000,
              category: "Đấu Giá Thắng Cuộc",
              rarity: existingArt?.rarity || "collector",
            });
          }
        }

        if (isMounted) {
          setArtworks((prev) => {
            const combined = [...prev, ...onChainMints];
            return Array.from(new Map(combined.map((item) => [item.mintAddress, item])).values()).filter(
              (item) => !isArtworkSoldBySeller(item.mintAddress, walletStr)
            );
          });
        }
      } catch (err) {
        console.warn("Failed to scan on-chain token accounts:", err);
      } finally {
        if (isMounted) setIsLoadingOnChain(false);
      }
    }

    scanOnChainTokens();

    return () => {
      isMounted = false;
    };
  }, [publicKey, connection]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(id);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleDelete = (mintAddress: string) => {
    if (!publicKey) return;
    const walletStr = publicKey.toBase58();
    deleteMintedArtwork(mintAddress, walletStr);
    setArtworks((prev) => prev.filter((a) => a.mintAddress !== mintAddress));
  };

  const handleDownload = (imageUrl: string, title: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "mintly-nft"}.png`;
    link.click();
  };

  const walletStr = publicKey ? publicKey.toBase58() : "";
  const filteredArtworks = (activeFilter === "all" ? artworks : artworks.slice(0, 6)).filter(
    (item) => !isArtworkSoldBySeller(item.mintAddress, walletStr)
  );

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-28 sm:px-8 sm:pt-32">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-text-dim">
          <Link href="/" className="transition-colors hover:text-text">{t("nav.explore")}</Link>
          <span>/</span>
          <span className="text-accent-strong">{t("nav.portfolio")}</span>
        </div>

        {/* Profile / Vault Header */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[rgba(26,26,26,0.8)] via-[rgba(18,18,18,0.9)] to-[rgba(10,10,10,0.95)] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-5 sm:items-center">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-accent/40 bg-accent/10 font-display text-2xl text-accent shadow-[0_0_30px_rgba(184,165,255,0.25)] sm:size-20 sm:text-3xl">
                🎨
              </div>

              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-2xl text-text sm:text-4xl">
                    {t("portfolio.title")}
                  </h1>
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-green-400">
                    Solana Devnet
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-text-dim sm:text-sm">
                  {t("portfolio.subtitle")}
                </p>

                {connected && publicKey && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-accent">
                      {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                    </span>
                    <button
                      onClick={() => handleCopy(publicKey.toBase58(), "wallet")}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:border-accent/40 hover:text-text"
                    >
                      {copiedAddress === "wallet" ? t("wallet.copied") : t("wallet.copy")}
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:border-accent/40 hover:text-text"
                    >
                      Explorer ↗
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            {connected && (
              <div className="flex flex-wrap gap-4 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3.5">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    {t("portfolio.totalCreated")}
                  </span>
                  <span className="font-display text-2xl font-bold text-accent sm:text-3xl">
                    {artworks.length}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3.5">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Số dư SOL
                  </span>
                  <span className="font-display text-2xl font-bold text-text sm:text-3xl">
                    {solBalance.toFixed(3)}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3.5">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    {t("portfolio.verifiedOnChain")}
                  </span>
                  <span className="font-display text-2xl font-bold text-green-400 sm:text-3xl">
                    100%
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Not connected state */}
        {!connected ? (
          <section className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02] py-20 text-center">
            <div className="flex size-16 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-2xl text-accent">
              🔒
            </div>
            <h2 className="mt-5 font-display text-2xl text-text sm:text-3xl">
              {t("create.connectTitle")}
            </h2>
            <p className="mt-2 max-w-md text-sm text-text-dim">
              {t("create.connectText")}
            </p>
            <button
              onClick={() => setVisible(true)}
              className="mt-6 rounded-full bg-accent px-8 py-3.5 font-sans text-xs font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-10px_rgba(184,165,255,0.8)]"
            >
              {t("nav.connect")}
            </button>
          </section>
        ) : (
          <>
            {/* Action Bar & Controls */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    activeFilter === "all"
                      ? "bg-white text-black"
                      : "text-text-dim hover:bg-white/5 hover:text-text"
                  }`}
                >
                  Tác Phẩm Của Tôi ({artworks.length})
                </button>

                <button
                  onClick={() => setActiveFilter("bidding")}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    activeFilter === "bidding"
                      ? "bg-accent text-black font-bold shadow-[0_0_20px_rgba(184,165,255,0.4)]"
                      : "text-text-dim hover:bg-white/5 hover:text-text"
                  }`}
                >
                  <span>🎯</span>
                  <span>Đang Tham Gia Đấu Giá ({myActiveBids.length})</span>
                </button>
              </div>

              <Link
                href="/create"
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-sans text-xs font-bold uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_8px_30px_-6px_rgba(184,165,255,0.6)]"
              >
                <span>+</span>
                <span>{t("portfolio.createNow")}</span>
              </Link>
            </div>

            {/* Bidding Filter View */}
            {activeFilter === "bidding" && (
              <div className="mt-8">
                {myActiveBids.length === 0 ? (
                  <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.01] py-20 text-center">
                    <div className="flex size-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-4xl">
                      🎯
                    </div>
                    <h3 className="mt-6 font-display text-2xl text-text">
                      Chưa Tham Gia Đấu Giá Tác Phẩm Nào
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-text-dim">
                      Khám phá các phiên đấu giá trực tiếp trên sàn MINTLY và đặt giá ngay!
                    </p>
                    <Link
                      href="/auctions"
                      className="mt-6 rounded-full bg-accent px-8 py-3.5 font-sans text-xs font-bold uppercase tracking-wider text-[#0a0a0a]"
                    >
                      Khám Phá Sàn Đấu Giá
                    </Link>
                  </section>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {myActiveBids.map((bid, bIdx) => {
                      const auction = auctionMap[bid.auctionPda];
                      const nowUnix = Math.floor(Date.now() / 1000);
                      const isSettled = auction?.status?.toUpperCase() === "SETTLED";
                      const isEnded = isSettled || (auction?.endTime ? nowUnix >= auction.endTime : false);
                      const artworkImage = auction?.image || (auction?.nftMint ? getArtworkImage(auction.nftMint) : null) || "/assets/messi-symphony.svg";

                      const savedBids = getAllSavedBidsForAuction(bid.auctionPda);
                      const topSaved = savedBids.length > 0 ? savedBids[0].bidAmountSol : 0;
                      const highestBid = Math.max(
                        parseFloat(auction?.currentBid || "0"),
                        topSaved,
                        parseFloat(auction?.startPrice || "0"),
                        bid.bidAmountSol
                      );
                      const isLeading = bid.bidAmountSol >= highestBid;

                      return (
                        <Link
                          key={bid.auctionPda || bIdx}
                          href={`/auctions/${bid.auctionPda}`}
                          className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 ${
                            isSettled
                              ? "border-green-500/30 bg-[rgba(16,24,18,0.85)] opacity-85 hover:opacity-100 hover:border-green-400 shadow-[0_0_25px_rgba(74,222,128,0.15)]"
                              : isEnded
                              ? "border-white/10 bg-[rgba(18,18,20,0.85)] opacity-70 hover:opacity-100 hover:border-white/20 shadow-none"
                              : "border-accent/40 bg-[rgba(20,20,20,0.85)] shadow-[0_0_25px_rgba(184,165,255,0.15)] hover:border-accent hover:shadow-[0_0_35px_rgba(184,165,255,0.3)]"
                          }`}
                        >
                          {/* Image Thumbnail with Overlay Banner */}
                          <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#111] border-b border-white/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={artworkImage}
                              alt={auction?.title || "Auction Artwork"}
                              className={`size-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                                isEnded && !isSettled ? "grayscale-[0.4]" : ""
                              }`}
                            />

                            {/* Status Banner Over Image */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/50 flex flex-col justify-between p-3">
                              <div className="flex items-center justify-between">
                                {isSettled ? (
                                  <span className="rounded-full border border-green-500/40 bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold text-green-300 backdrop-blur-md">
                                    🏆 Đã Hoàn Tất
                                  </span>
                                ) : isEnded ? (
                                  <span className="rounded-full border border-white/20 bg-black/70 px-2.5 py-0.5 text-[10px] font-bold text-text-dim backdrop-blur-md">
                                    🏁 Đã Kết Thúc
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold text-accent backdrop-blur-md">
                                    <span>🎯</span>
                                    <span>Đang Diễn Ra</span>
                                  </span>
                                )}

                                {/* Top Right: Prominent Max Bid Badge */}
                                <span className="font-mono text-[11px] font-bold text-accent rounded-full bg-black/70 px-2.5 py-0.5 backdrop-blur-md border border-white/10 flex items-center gap-1">
                                  <span className="text-[9px] text-text-dim uppercase font-sans">Cao nhất:</span>
                                  <span>{highestBid.toFixed(2)} SOL</span>
                                </span>
                              </div>

                              {/* Big Center Banner for Ended / Settled */}
                              {isSettled ? (
                                <div className="rounded-xl border border-green-500/40 bg-green-950/80 py-1.5 px-2.5 text-center text-[11px] font-bold text-green-300 backdrop-blur-md shadow-lg">
                                  🎉 ĐÃ CHỐT DEAL THÀNH CÔNG
                                </div>
                              ) : isEnded ? (
                                <div className="rounded-xl border border-white/15 bg-black/80 py-1.5 px-2.5 text-center text-[11px] font-bold text-text-dim backdrop-blur-md">
                                  🏁 PHIÊN ĐẤU GIÁ ĐÃ KẾT THÚC
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Card Details */}
                          <div className="p-4 flex flex-1 flex-col justify-between space-y-3">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-display text-base text-text group-hover:text-accent transition-colors line-clamp-1">
                                  {auction?.title || `Phiên Đấu Giá #${bid.auctionPda.slice(0, 4)}`}
                                </h4>
                                {!isEnded && (
                                  isLeading ? (
                                    <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold text-green-400 border border-green-500/30">
                                      👑 Dẫn Đầu
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 border border-amber-500/30">
                                      ⚡ Bị Vượt
                                    </span>
                                  )
                                )}
                              </div>
                              <div className="mt-1 font-mono text-[10px] text-text-dim/80 truncate">
                                Auction: {bid.auctionPda.slice(0, 6)}...{bid.auctionPda.slice(-6)}
                              </div>
                            </div>

                            {/* Bidding Summary Box */}
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-text-dim text-[11px]">🔥 Giá cao nhất (Max):</span>
                                <span className="font-mono font-bold text-accent text-sm">
                                  {highestBid.toFixed(2)} SOL
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                <span className="text-text-dim text-[11px]">🎯 Giá của bạn:</span>
                                <span className="font-mono font-bold text-text">
                                  {bid.bidAmountSol.toFixed(2)} SOL
                                </span>
                              </div>
                              {bid.timestamp && (
                                <div className="flex justify-between items-center text-[10px] text-text-dim/70">
                                  <span>Thời gian đặt:</span>
                                  <span>{new Date(bid.timestamp).toLocaleTimeString("vi-VN")}</span>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs font-bold text-accent group-hover:underline">
                              <span>{isSettled ? "Xem Chi Tiết Quyết Toán" : isEnded ? "Xem Kết Quả Đấu Giá" : "Xem & Đặt Giá Tiếp"}</span>
                              <span>→</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Standard Artworks Filter View */}
            {activeFilter === "all" && (
              <>
                {/* Empty State */}
                {artworks.length === 0 ? (
                  <section className="mt-12 flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.01] py-20 text-center">
                    <div className="flex size-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-4xl">
                      🖼️
                    </div>
                    <h3 className="mt-6 font-display text-2xl text-text">
                      {t("portfolio.emptyTitle")}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-text-dim">
                      {t("portfolio.emptyText")}
                    </p>
                    <Link
                      href="/create"
                      className="mt-6 rounded-full bg-accent px-8 py-3.5 font-sans text-xs font-bold uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-accent-strong"
                    >
                      {t("portfolio.createNow")}
                    </Link>
                  </section>
                ) : (
                  /* Artwork Grid */
                  <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredArtworks.map((item, idx) => {
                      const truncatedMint = `${item.mintAddress.slice(0, 6)}...${item.mintAddress.slice(-6)}`;
                      const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });

                      const nowUnix = Math.floor(Date.now() / 1000);
                      const isSettled = isAuctionSettled(item.mintAddress);
                      const activeAuction = isSettled
                        ? undefined
                        : allLiveAuctions.find(
                            (a) =>
                              a.nftMint?.toLowerCase() === item.mintAddress?.toLowerCase() &&
                              a.status?.toUpperCase() !== "SETTLED" &&
                              a.status?.toUpperCase() !== "CANCELLED" &&
                              !isAuctionSettled(a.id) &&
                              !isAuctionSettled(a.nftMint) &&
                              (a.endTime ? nowUnix < a.endTime : true)
                          );

                      return (
                        <article
                          key={item.mintAddress || idx}
                          className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-[rgba(20,20,20,0.85)] p-4 shadow-lg transition-all duration-300 ${
                            activeAuction
                              ? "border-purple-500/40 shadow-[0_0_25px_rgba(184,165,255,0.2)]"
                              : "border-white/10 hover:border-accent/40 hover:shadow-[0_15px_45px_-15px_rgba(184,165,255,0.2)]"
                          }`}
                        >
                      {/* Image Frame */}
                      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#111] border border-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="size-full object-contain transition-transform duration-500 group-hover:scale-105"
                        />

                        {/* Rarity & Format Pill or Live Auction Pill */}
                        {activeAuction ? (
                          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-950/85 px-2.5 py-1 text-[10px] font-bold text-accent backdrop-blur-md shadow-lg">
                            <span>🔥</span>
                            <span>Đang Đấu Giá Trên Sàn</span>
                          </div>
                        ) : (
                          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-accent backdrop-blur-md">
                            <span>✨</span>
                            <span>Độc bản 1/1</span>
                          </div>
                        )}

                        {/* Quick Overlay Action Buttons */}
                        <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 backdrop-blur-md transition-all group-hover:opacity-100">
                          <button
                            onClick={() => handleDownload(item.imageUrl, item.title)}
                            title={t("portfolio.download")}
                            className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/60 text-text-dim transition-colors hover:text-white hover:border-white/30"
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {!activeAuction && (
                            <button
                              onClick={() => handleDelete(item.mintAddress)}
                              title="Xóa khỏi kho tác phẩm"
                              className="flex size-8 items-center justify-center rounded-full border border-red-500/30 bg-black/60 text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/50"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mt-4 flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-lg text-text line-clamp-1 group-hover:text-accent transition-colors">
                              {item.title}
                            </h3>
                            {!activeAuction && (
                              <button
                                onClick={() => handleDelete(item.mintAddress)}
                                title="Xóa khỏi kho"
                                className="text-text-dim/40 transition-colors hover:text-red-400 p-1"
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-text-dim line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Mint Address Tag */}
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                            <span className="font-mono text-[11px] text-text-dim" title={item.mintAddress}>
                              {truncatedMint}
                            </span>
                            <button
                              onClick={() => handleCopy(item.mintAddress, item.mintAddress)}
                              className="text-[10px] text-accent transition-colors hover:underline"
                            >
                              {copiedAddress === item.mintAddress ? t("wallet.copied") : t("wallet.copy")}
                            </button>
                          </div>

                          <span className="mt-2 block text-[10px] text-text-dim/70">
                            {t("portfolio.createdOn")}: {dateStr}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex flex-col gap-2 border-t border-white/5 pt-3">
                          {activeAuction ? (
                            <Link
                              href={`/auctions/${activeAuction.id}`}
                              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600/20 border border-purple-500/40 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-accent transition-all hover:bg-accent hover:text-[#0a0a0a] shadow-[0_0_20px_rgba(184,165,255,0.3)]"
                            >
                              <span>🔥</span>
                              <span>Đang Trên Sàn Đấu Giá (Xem Ngay) ↗</span>
                            </Link>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedArtworkForAuction(item);
                                setIsAuctionModalOpen(true);
                              }}
                              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_8px_25px_-5px_rgba(184,165,255,0.7)]"
                            >
                              <span>🔨</span>
                              <span>Đưa Lên Đấu Giá (Start Auction)</span>
                            </button>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <Link
                              href={`/passport/${item.mintAddress}`}
                              className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-center text-xs font-semibold text-accent transition-all hover:bg-accent hover:text-[#0a0a0a]"
                            >
                              {t("portfolio.viewPassport")}
                            </Link>

                            <a
                              href={`https://explorer.solana.com/address/${item.mintAddress}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs font-semibold text-text-dim transition-colors hover:border-white/20 hover:text-text"
                            >
                              Explorer ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </>
    )}
  </main>

      <CreateAuctionModal
        artwork={selectedArtworkForAuction}
        isOpen={isAuctionModalOpen}
        onClose={() => {
          setIsAuctionModalOpen(false);
          setSelectedArtworkForAuction(null);
        }}
      />

      <Footer />
    </div>
  );
}
