"use client";

import { useEffect, useState, useCallback, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import {
  fetchAuctionById,
  fetchCommitmentsForAuction,
  fetchTotalAuctionBidsVolume,
  type Auction,
  type CommitmentRecord,
} from "@/lib/data";
import {
  computeCommitmentHash,
  generateRandomSecret,
  saveBidSecretLocally,
  getSavedBidSecret,
  getAllSavedBidsForAuction,
} from "@/lib/auction-crypto";
import {
  commitBidOnChain,
  revealBidOnChain,
} from "@/lib/commitReveal";
import {
  payAuctionDeposit,
  payAuctionBalance,
  placeBidWithEscrowDeposit,
  payAuctionRemainingBalance,
  claimDefaultWinnerPenalty,
} from "@/lib/marketplace";
import { getMarketplaceProgram } from "@/utils/anchor";
import { saveMintedArtwork, markArtworkAsSold, isAuctionSettled, updateSecondaryAuctionBid } from "@/lib/artworkCache";
import { useI18n } from "@/lib/i18n";

type Phase =
  | "LIVE"
  | "PAYMENT_PENDING"
  | "SETTLED"
  | "DEFAULTED"
  | "CANCELLED";

export default function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t } = useI18n();
  const { id } = use(params);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [commitments, setCommitments] = useState<CommitmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformTotalBidsSol, setPlatformTotalBidsSol] = useState<number>(0);
  const [walletSolBalance, setWalletSolBalance] = useState<number>(0);

  // Form states
  const [bidAmountSol, setBidAmountSol] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Computed phase
  const [currentPhase, setCurrentPhase] = useState<Phase>("LIVE");
  const [nowUnix, setNowUnix] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowUnix(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAuctionData = useCallback(async () => {
    try {
      const [data, totalVol] = await Promise.all([
        fetchAuctionById(connection, id),
        fetchTotalAuctionBidsVolume(connection),
      ]);
      setAuction(data);
      setPlatformTotalBidsSol(totalVol);

      if (wallet.publicKey) {
        connection.getBalance(wallet.publicKey).then((b) => setWalletSolBalance(b / 1e9)).catch(() => {});
      }

      if (data) {
        try {
          const auctionPubkey = new PublicKey(data.id);
          const comms = await fetchCommitmentsForAuction(connection, auctionPubkey);
          setCommitments(comms);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error("Failed to load auction detail:", e);
    } finally {
      setLoading(false);
    }
  }, [connection, id, wallet.publicKey]);

  useEffect(() => {
    loadAuctionData();
    const interval = setInterval(loadAuctionData, 30000);
    return () => clearInterval(interval);
  }, [loadAuctionData]);

  // Compute Phase
  useEffect(() => {
    if (!auction) return;

    const auctionStartTimeMs = (auction.startTime || 0) * 1000;
    if (
      isAuctionSettled(id, auctionStartTimeMs) ||
      (auction.id && isAuctionSettled(auction.id, auctionStartTimeMs)) ||
      (auction.nftMint && isAuctionSettled(auction.nftMint, auctionStartTimeMs))
    ) {
      setCurrentPhase("SETTLED");
      return;
    }

    const status = auction.status?.toUpperCase() || "";
    if (status === "SETTLED") {
      setCurrentPhase("SETTLED");
      return;
    }
    if (status === "DEFAULTED") {
      setCurrentPhase("DEFAULTED");
      return;
    }
    if (status === "CANCELLED") {
      setCurrentPhase("CANCELLED");
      return;
    }

    const end = auction.endTime || 0;
    if (nowUnix < end) {
      setCurrentPhase("LIVE");
    } else {
      setCurrentPhase("PAYMENT_PENDING");
    }
  }, [auction, id, nowUnix]);

  // Handler: Place Realtime Bid
  async function handlePlaceBid(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction || !auction) {
      setActionError("Ví Phantom đang bị khóa hoặc chưa kết nối. Vui lòng mở tiện ích Phantom, nhập mật khẩu và bấm Kết Nối Ví để tiếp tục.");
      return;
    }

    const amount = parseFloat(bidAmountSol);
    const minRequired = parseFloat(minRequiredBid);

    if (isNaN(amount) || amount < minRequired) {
      setActionError(`Giá đặt phải lớn hơn hoặc bằng mức tối thiểu: ${minRequired.toFixed(2)} SOL`);
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const [balanceLamports, livePlatformVolume] = await Promise.all([
        connection.getBalance(wallet.publicKey),
        fetchTotalAuctionBidsVolume(connection),
      ]);
      const balanceSol = balanceLamports / 1e9;
      setWalletSolBalance(balanceSol);

      const effectiveTotalPlatformBids = Math.max(livePlatformVolume, amount);
      const requiredEligibilitySol = effectiveTotalPlatformBids * 0.10;

      if (balanceSol < requiredEligibilitySol) {
        setActionError(
          `❌ Điều kiện không hợp lệ: Số dư ví (${balanceSol.toFixed(3)} SOL) phải lớn hơn hoặc bằng 10% (${requiredEligibilitySol.toFixed(3)} SOL) trên tổng số SOL đã đấu giá trên sàn trong tất cả giao dịch (${effectiveTotalPlatformBids.toFixed(3)} SOL).`
        );
        setIsSubmitting(false);
        return;
      }

      const depositSol = amount * 0.10;
      setActionStatus(`Đang chuyển 10% tiền cọc (${depositSol.toFixed(3)} SOL) vào Escrow PDA của sàn...`);
      const amountLamports = Math.floor(amount * 1e9);
      const secret = generateRandomSecret();
      const { commitmentHex } = await computeCommitmentHash(amountLamports, secret);

      const auctionPubkey = new PublicKey(auction.id);
      
      // Transfer 10% deposit directly to Escrow PDA on-chain
      const { txHash } = await placeBidWithEscrowDeposit(
        connection,
        wallet,
        auctionPubkey,
        amount
      );
      
      // Save locally for Anonymous Realtime Leaderboard & History
      saveBidSecretLocally({
        auctionPda: auction.id,
        bidder: wallet.publicKey.toBase58(),
        bidAmountSol: amount,
        bidAmountLamports: amountLamports,
        secret,
        commitmentHex,
        timestamp: Date.now(),
      });

      if (id && id !== auction.id) {
        saveBidSecretLocally({
          auctionPda: id,
          bidder: wallet.publicKey.toBase58(),
          bidAmountSol: amount,
          bidAmountLamports: amountLamports,
          secret,
          commitmentHex,
          timestamp: Date.now(),
        });
      }

      updateSecondaryAuctionBid(auction.id, amount, wallet.publicKey.toBase58());
      if (id) updateSecondaryAuctionBid(id, amount, wallet.publicKey.toBase58());

      setLastTxHash(txHash);
      setActionStatus(`✓ Đặt giá ${amount.toFixed(2)} SOL thành công! Đã nạp 10% cọc (${depositSol.toFixed(3)} SOL) an toàn vào Smart Contract Escrow.`);
      setBidAmountSol("");
      await loadAuctionData();
    } catch (err: any) {
      console.error("Place bid error:", err);
      const errStr = String(err?.message || "") + " " + JSON.stringify(err?.logs || []) + " " + String(err);
      if (errStr.includes("not connected") || errStr.includes("WalletSignTransactionError") || errStr.includes("User rejected")) {
        let msg = "Ví Phantom đang bị khóa hoặc ngắt kết nối. Vui lòng mở khóa Phantom để ký giao dịch nạp 10% cọc.";
        if (errStr.includes("User rejected")) {
          msg = "Bạn đã hủy yêu cầu ký nạp 10% cọc trên ví Phantom.";
        }
        setActionError(msg);
      } else {
        let msg = err?.message || "Giao dịch đặt giá & nạp cọc thất bại. Vui lòng thử lại.";
        setActionError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handler: Pay remaining 90% and Settle NFT
  async function handlePayFullPaymentAndSettle() {
    if (!wallet.publicKey || !wallet.signTransaction || !auction || !auction.nftMint || !auction.seller) return;
    const currentBidNum = effectiveHighestBidNum;
    const remaining90Num = currentBidNum * 0.90;
    const deposit10Num = currentBidNum * 0.10;

    setIsSubmitting(true);
    setActionError(null);
    setActionStatus(`Đang thanh toán 90% còn lại (${remaining90Num.toFixed(2)} SOL) & Hoàn tất nhận quyền sở hữu NFT...`);

    try {
      const auctionPubkey = new PublicKey(auction.id);
      const nftMintPubkey = new PublicKey(auction.nftMint);
      const sellerPubkey = new PublicKey(auction.seller);

      const tx = await payAuctionRemainingBalance(
        connection,
        wallet,
        auctionPubkey,
        nftMintPubkey,
        sellerPubkey,
        currentBidNum
      );

      setLastTxHash(tx);
      
      // Mark artwork as sold and transfer from seller to buyer
      if (auction.nftMint && wallet.publicKey) {
        markArtworkAsSold({
          mintAddress: auction.nftMint,
          seller: auction.seller,
          buyer: wallet.publicKey.toBase58(),
          soldAt: Date.now(),
          auctionPda: auction.id,
          priceSol: currentBidNum,
        });

        // Save won NFT into winner's portfolio
        saveMintedArtwork({
          mintAddress: auction.nftMint,
          title: auction.title || `Tác phẩm Đấu Giá #${auction.nftMint.slice(0, 4)}`,
          description: `Tác phẩm NFT thắng cuộc từ phiên đấu giá MINTLY với mức giá ${currentBidNum.toFixed(2)} SOL (Đã cọc 10%: ${deposit10Num.toFixed(2)} SOL + thanh toán 90%: ${remaining90Num.toFixed(2)} SOL).`,
          imageUrl: auction.image || "/assets/messi-symphony.svg",
          creator: wallet.publicKey.toBase58(),
          createdAt: Date.now(),
          category: "Đấu Giá Thắng Cuộc",
          rarity: "collector",
        });
      }

      setActionStatus(`🎉 ĐẤU GIÁ THÀNH CÔNG! Đã thanh toán 90% còn lại (${remaining90Num.toFixed(2)} SOL) + giải phóng 10% cọc (${deposit10Num.toFixed(2)} SOL), NFT đã được chuyển sang ví của bạn.`);
      setCurrentPhase("SETTLED");
      setAuction((prev) => (prev ? { ...prev, status: "SETTLED" } : prev));
      await loadAuctionData();
    } catch (err: any) {
      console.error("Payment error:", err);
      setActionError(err.message || "Thanh toán thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handler: Seller claims 10% forfeited deposit when winner defaults
  async function handleClaimDefaultPenalty() {
    if (!wallet.publicKey || !wallet.signTransaction || !auction || !auction.seller) return;
    const currentBidNum = effectiveHighestBidNum;
    const penaltySol = (currentBidNum * 0.10).toFixed(3);

    setIsSubmitting(true);
    setActionError(null);
    setActionStatus(`Đang xử phạt bùng kèo & rút ${penaltySol} SOL tiền cọc từ Escrow về ví Seller...`);

    try {
      const auctionPubkey = new PublicKey(auction.id);
      const sellerPubkey = new PublicKey(auction.seller);

      const tx = await claimDefaultWinnerPenalty(
        connection,
        wallet,
        auctionPubkey,
        sellerPubkey
      );

      setLastTxHash(tx);
      setActionStatus(`✓ Xử phạt thành công! Đã thu hồi ${penaltySol} SOL tiền cọc bùng kèo từ Escrow về ví Seller.`);
      await loadAuctionData();
    } catch (err: any) {
      console.error("Penalty claim error:", err);
      setActionError(err.message || "Xử phạt bùng kèo thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0b0d] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="font-display text-lg text-text animate-pulse">
              Đang tải dữ liệu đấu giá Realtime On-chain...
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0b0d] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <section className="max-w-lg rounded-3xl border border-white/10 bg-[#121316] p-10 backdrop-blur-xl">
            <h1 className="font-display text-3xl text-text">Không Tìm Thấy Đấu Giá</h1>
            <p className="mt-3 text-sm text-text-dim">
              Phiên đấu giá này không tồn tại hoặc đã bị hủy trên Solana Devnet.
            </p>
            <Link
              href="/auctions"
              className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#141313]"
            >
              Về Danh Sách Đấu Giá
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Time calculations
  const auctionTimeLeft = Math.max(0, (auction.endTime || 0) - nowUnix);
  const paymentDeadlineTimestamp = auction.depositDeadline || auction.paymentDeadline || ((auction.endTime || 0) + 2 * 86400);
  const paymentTimeLeft = Math.max(0, paymentDeadlineTimestamp - nowUnix);

  function formatTime(seconds: number): string {
    if (seconds <= 0) return "00:00:00";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) {
      return `${d} ngày ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  const auctionStartTimeMs = (auction?.startTime || 0) * 1000;
  const savedBids = Array.from(
    new Map(
      [
        ...getAllSavedBidsForAuction(id, auctionStartTimeMs),
        ...(auction?.id ? getAllSavedBidsForAuction(auction.id, auctionStartTimeMs) : []),
        ...(auction?.nftMint ? getAllSavedBidsForAuction(auction.nftMint, auctionStartTimeMs) : []),
      ].map((b) => [`${b.bidder}-${b.bidAmountSol}`, b])
    ).values()
  ).sort((a, b) => b.bidAmountSol - a.bidAmountSol);

  const myBidRecord = wallet.publicKey
    ? savedBids.find((b) => b.bidder.toLowerCase() === wallet.publicKey!.toBase58().toLowerCase()) || null
    : null;

  const maxSavedBid = savedBids.length > 0 ? savedBids[0].bidAmountSol : 0;
  const onChainBidNum = parseFloat(auction.currentBid || "0");
  const startPriceNum = parseFloat(auction.startPrice || "0.01");
  const hasBidsPlaced = savedBids.length > 0 || (onChainBidNum > startPriceNum);
  const effectiveHighestBidNum = hasBidsPlaced ? Math.max(onChainBidNum, maxSavedBid) : startPriceNum;
  const effectiveHighestBidStr = effectiveHighestBidNum.toFixed(2);
  const minIncNum = parseFloat(auction.minIncrement || "0.01");
  const minRequiredBid = hasBidsPlaced ? (effectiveHighestBidNum + minIncNum).toFixed(2) : startPriceNum.toFixed(2);

  // Combine on-chain commitments & local records for unified anonymous feed
  const allBidsList = (() => {
    const list: Array<{
      bidder: string;
      amountSol: string;
      timestamp?: string;
      isMe: boolean;
      amountNum: number;
    }> = savedBids.map((s) => ({
      bidder: s.bidder,
      amountSol: `${s.bidAmountSol.toFixed(2)} SOL`,
      timestamp: s.timestamp ? new Date(s.timestamp).toLocaleTimeString("vi-VN") : undefined,
      isMe: wallet.publicKey ? s.bidder.toLowerCase() === wallet.publicKey.toBase58().toLowerCase() : false,
      amountNum: s.bidAmountSol,
    }));

    commitments.forEach((c) => {
      const exists = list.some((item) => item.bidder.toLowerCase() === c.bidder.toLowerCase());
      if (!exists) {
        const isMe = wallet.publicKey ? c.bidder.toLowerCase() === wallet.publicKey.toBase58().toLowerCase() : false;
        list.push({
          bidder: c.bidder,
          amountSol: c.revealedAmountSol || "Đã Cam Kết",
          timestamp: undefined,
          isMe,
          amountNum: 0,
        });
      }
    });

    return list.sort((a, b) => b.amountNum - a.amountNum);
  })();

  const isWinner = Boolean(
    wallet.publicKey &&
    (
      (auction.highestBidder && wallet.publicKey.toBase58().toLowerCase() === auction.highestBidder.toLowerCase()) ||
      (myBidRecord && myBidRecord.bidAmountSol >= effectiveHighestBidNum && effectiveHighestBidNum > 0) ||
      (allBidsList.length > 0 && allBidsList[0].isMe)
    )
  );

  // Format payment deadline duration for info text
  const totalPaymentDurationSecs = Math.max(0, paymentDeadlineTimestamp - (auction.endTime || 0));
  const paymentDaysText = Math.floor(totalPaymentDurationSecs / 86400);
  const paymentHoursText = Math.floor((totalPaymentDurationSecs % 86400) / 3600);
  const paymentDurationString = paymentDaysText > 0 
    ? `${paymentDaysText} ngày${paymentHoursText > 0 ? ` ${paymentHoursText} giờ` : ""}`
    : `${paymentHoursText || 48} giờ`;

  const totalBidsCount = Math.max(allBidsList.length, commitments.length);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0b0d] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pt-28 lg:px-16">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/auctions"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-dim hover:text-white"
          >
            <span>←</span>
            <span>Tất Cả Phiên Đấu Giá</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-accent">Solana Devnet Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Artwork Showcase & Provenance */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/15 bg-[#111315] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={auction.image}
                alt={auction.title}
                className="size-full object-contain"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

              {/* Status Badge */}
              <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-black/70 px-3.5 py-1.5 backdrop-blur-md">
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  ● {currentPhase === "LIVE" ? "ĐANG ĐẤU GIÁ REALTIME" : currentPhase === "SETTLED" ? "ĐÃ HOÀN TẤT & QUYẾT TOÁN" : currentPhase === "PAYMENT_PENDING" ? "HẾT GIỜ • CHỜ THANH TOÁN" : currentPhase}
                </span>
              </div>
            </div>

            {/* Smart Contract Proof Details */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                📜 Thông Tin On-Chain & Hợp Đồng Escrow
              </h3>
              <div className="space-y-3 font-mono text-xs text-text-dim">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Auction PDA:</span>
                  <a
                    href={`https://explorer.solana.com/address/${auction.id}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-text hover:text-accent underline truncate max-w-[200px]"
                  >
                    {auction.id}
                  </a>
                </div>

                {auction.nftMint && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>NFT Mint:</span>
                    <a
                      href={`https://explorer.solana.com/address/${auction.nftMint}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-text hover:text-accent underline truncate max-w-[200px]"
                    >
                      {auction.nftMint}
                    </a>
                  </div>
                )}

                {auction.seller && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span>Tác Giả (Seller):</span>
                    <span className="text-text truncate max-w-[200px]">{auction.seller}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Tổng Số Lượt Đặt Giá:</span>
                  <span className="text-accent font-bold">{totalBidsCount} Lượt Bid</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Realtime Auction Dashboard */}
          <div className="lg:col-span-6 space-y-6">
            {/* Title & Creator */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                Đấu Giá Realtime Trực Tiếp
              </span>
              <h1 className="mt-1 font-display text-4xl uppercase text-text sm:text-5xl">
                {auction.title}
              </h1>
              <p className="mt-2 text-xs text-text-dim">
                Tác giả: <span className="font-mono text-text">{auction.artist}</span>
              </p>
            </div>

            {/* USER PARTICIPATION GLOW CARD */}
            {myBidRecord && (
              <div className="rounded-3xl border border-accent/50 bg-gradient-to-r from-accent/15 via-purple-500/10 to-accent/5 p-5 backdrop-blur-md shadow-[0_0_35px_rgba(184,165,255,0.2)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/20 text-xl shadow-inner">
                      🎯
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent">
                          Bạn Đang Tham Gia Đấu Giá Này
                        </span>
                        {myBidRecord.bidAmountSol >= effectiveHighestBidNum ? (
                          <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/30">
                            👑 Bạn đang dẫn đầu
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                            ⚡ Có người vừa đặt giá cao hơn
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-dim">
                        Mức giá bạn đã đặt:{" "}
                        <span className="font-mono font-bold text-text">
                          {myBidRecord.bidAmountSol.toFixed(2)} SOL
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-right">
                    <span className="text-[9px] font-mono uppercase text-text-dim block">Giá Của Bạn</span>
                    <span className="font-mono text-base font-bold text-accent">
                      {myBidRecord.bidAmountSol.toFixed(2)} SOL
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Price & Countdown Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-dim flex items-center gap-1.5">
                    <span>Giá Cao Nhất Hiện Tại (Realtime)</span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      🔒 Ẩn danh tính
                    </span>
                  </div>
                  <div className="mt-1 font-display text-4xl text-text">
                    {effectiveHighestBidStr}{" "}
                    <span className="text-2xl text-accent">SOL</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-text-dim">
                    {currentPhase === "LIVE" ? "Thời Gian Còn Lại" : "Trạng Thái"}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-accent">
                    {currentPhase === "LIVE" ? formatTime(auctionTimeLeft) : currentPhase === "SETTLED" ? "ĐÃ QUYẾT TOÁN" : currentPhase === "DEFAULTED" ? "BÙNG KÈO" : "ĐÃ CHỐT DEAL"}
                  </div>
                </div>
              </div>

              {/* LIVE BIDDING FORM */}
              {currentPhase === "LIVE" && (
                <form onSubmit={handlePlaceBid} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                        Số Tiền Muốn Đặt Giá (SOL)
                      </label>
                      <span className="text-[11px] font-mono text-accent">
                        Tối thiểu: {minRequiredBid} SOL
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min={minRequiredBid}
                      placeholder={`Nhập từ ${minRequiredBid} SOL trở lên...`}
                      value={bidAmountSol}
                      onChange={(e) => setBidAmountSol(e.target.value)}
                      disabled={isSubmitting}
                      className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                      required
                    />

                    {/* Deposit on Bid Escrow Info Card */}
                    <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/[0.04] p-4 text-xs space-y-2.5 backdrop-blur-md">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-accent flex items-center gap-1.5">
                          <span>🛡️</span>
                          <span>Ký Cọc 10% Qua Smart Contract Escrow</span>
                        </span>
                        <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent border border-accent/30">
                          Cọc 10%: {(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL
                        </span>
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-text-dim list-disc list-inside leading-relaxed">
                        <li>
                          Khi bấm Xác Nhận, ví Phantom sẽ trừ <strong>10% tiền cọc ({(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL)</strong> chuyển vào hợp đồng <strong>Escrow PDA</strong> của sàn.
                        </li>
                        <li>
                          <strong>Tự Động Hoàn Cọc</strong>: Nếu bạn bị người khác đặt giá cao hơn, tiền cọc sẽ được hoàn trả 100% tự động về ví của bạn.
                        </li>
                        <li>
                          <strong>Khi Thắng Cuộc</strong>: Bạn chỉ cần thanh toán <strong>90% còn lại ({(parseFloat(bidAmountSol || minRequiredBid) * 0.90).toFixed(2)} SOL)</strong> để nhận NFT.
                        </li>
                      </ul>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_35px_-5px_rgba(184,165,255,0.7)] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="size-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        <span>Đang Chuyển 10% Cọc Vào Escrow...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Xác Nhận Đặt Giá {bidAmountSol ? `${bidAmountSol} SOL` : ""} (Nạp Cọc 10%: {(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL)</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* PAYMENT PENDING PHASE (CHỐT DEAL & THANH TOÁN 90% CÒN LẠI) */}
              {currentPhase === "PAYMENT_PENDING" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 text-xs text-purple-200 space-y-3">
                    <div className="font-bold flex items-center gap-2 text-base text-purple-300">
                      <span>🏆</span>
                      <span>Phiên Đấu Giá Đã Chốt Deal!</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-purple-500/20 font-mono text-xs">
                      <div className="flex justify-between text-text-dim">
                        <span>Giá Thắng Cuộc (100%):</span>
                        <span className="text-text text-sm font-bold">
                          {effectiveHighestBidStr} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-green-400">
                        <span>Tiền Cọc 10% Đã Nạp Sẵn Vào Escrow:</span>
                        <span className="font-bold">
                          -{(effectiveHighestBidNum * 0.10).toFixed(2)} SOL ✓
                        </span>
                      </div>
                      <div className="flex justify-between text-accent pt-1 border-t border-white/5 font-bold text-sm">
                        <span>Số Tiền Cần Thanh Toán Ngay (90%):</span>
                        <span className="text-base font-display">
                          {(effectiveHighestBidNum * 0.90).toFixed(2)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-text-dim pt-1">
                        <span>Hạn Chót Thanh Toán:</span>
                        <span className="font-mono text-accent font-bold">
                          {formatTime(paymentTimeLeft)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <span>⚠️</span>
                        <span>Quy Định Xử Phạt Bùng Kèo 10% Cọc</span>
                      </div>
                      <p className="leading-relaxed">
                        Người thắng phải thanh toán <strong>90% còn lại ({(effectiveHighestBidNum * 0.90).toFixed(2)} SOL)</strong> trước hạn chót. Nếu quá hạn không thanh toán, <strong>10% tiền cọc ({(effectiveHighestBidNum * 0.10).toFixed(3)} SOL)</strong> đang giữ trong Escrow sẽ tự động được giải phóng để bồi thường cho Seller!
                      </p>
                    </div>
                  </div>

                  {isWinner ? (
                    <button
                      onClick={handlePayFullPaymentAndSettle}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-accent-strong shadow-[0_10px_35px_-5px_rgba(184,165,255,0.8)] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          <span>Đang Quyết Toán 90% & Nhận NFT...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>Thanh Toán 90% Còn Lại ({(effectiveHighestBidNum * 0.90).toFixed(2)} SOL) & Nhận NFT Ngay</span>
                        </>
                      )}
                    </button>
                  ) : wallet.publicKey && auction.seller && wallet.publicKey.toBase58().toLowerCase() === auction.seller.toLowerCase() && paymentTimeLeft <= 0 ? (
                    <button
                      onClick={handleClaimDefaultPenalty}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-red-600 hover:bg-red-500 py-4 text-xs font-bold uppercase tracking-wider text-white shadow-[0_10px_35px_-5px_rgba(239,68,68,0.8)] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      <span>⚠️</span>
                      <span>Phạt Bùng Kèo: Thu Hồi 10% Cọc ({(effectiveHighestBidNum * 0.10).toFixed(3)} SOL) Về Ví Seller</span>
                    </button>
                  ) : (
                    <p className="text-center text-xs text-text-dim">
                      Đang chờ Người Thắng Cuộc hoàn tất thanh toán 90% còn lại để chuyển giao quyền sở hữu NFT...
                    </p>
                  )}
                </div>
              )}

              {/* SETTLED PHASE */}
              {currentPhase === "SETTLED" && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center space-y-3">
                  <div className="text-3xl">🎉</div>
                  <h3 className="font-display text-xl text-green-300">
                    Phiên Đấu Giá Đã Quyết Toán Xong!
                  </h3>
                  <p className="text-xs text-text-dim">
                    Quyền sở hữu NFT đã được chuyển thành công tới Winner on-chain. Tiền bán đã được chuyển tới Seller.
                  </p>
                  {auction.nftMint && (
                    <Link
                      href={`/passport/${auction.nftMint}`}
                      className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0a0a0a] hover:bg-accent-strong"
                    >
                      <span>🛡️</span>
                      <span>Xem NFT Passport Mới Nhất</span>
                    </Link>
                  )}
                </div>
              )}

              {/* Status Message */}
              {actionStatus && (
                <div className="rounded-2xl border border-accent/30 bg-accent/10 p-3.5 text-xs text-accent">
                  {actionStatus}
                </div>
              )}

              {/* Error Message */}
              {actionError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                  {actionError}
                </div>
              )}

              {/* Last Transaction Link */}
              {lastTxHash && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-xs">
                  <span className="text-text-dim">Giao Dịch On-Chain: </span>
                  <a
                    href={`https://explorer.solana.com/tx/${lastTxHash}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-accent hover:underline break-all"
                  >
                    {lastTxHash}
                  </a>
                </div>
              )}
            </div>

            {/* Bids History Feed (Anonymous / Ẩn danh tính with highlighted badge for current user) */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md space-y-4">
              <h3 className="font-display text-lg text-text flex items-center justify-between">
                <span>Lịch Sử Đặt Giá ({allBidsList.length})</span>
                <span className="text-xs font-mono text-accent">🔒 Ẩn danh tính</span>
              </h3>

              {allBidsList.length === 0 ? (
                <p className="text-xs text-text-dim">Chưa có lượt đặt giá nào. Hãy là người đầu tiên đặt giá!</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allBidsList.map((c, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                        c.isMe
                          ? "border-accent/40 bg-accent/[0.08] shadow-[0_0_15px_rgba(184,165,255,0.1)]"
                          : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${c.isMe ? "bg-accent animate-pulse" : "bg-white/40"}`} />
                        <span className={`font-medium ${c.isMe ? "text-accent font-bold" : "text-text"}`}>
                          Người Đấu Giá #{allBidsList.length - idx}
                          {c.isMe && (
                            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/30">
                              Bạn
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-accent font-bold">
                          {c.amountSol}
                        </span>
                        {c.timestamp && (
                          <span className="font-mono text-text-dim text-[11px]">
                            {c.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
