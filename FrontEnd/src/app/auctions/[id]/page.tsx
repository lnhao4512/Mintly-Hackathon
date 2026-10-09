"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
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
  hydrateBidSecretsForAuction,
} from "@/lib/auction-crypto";
import { placeBidOnChain, payAuctionBalance, defaultWinnerOnChain, cancelAuctionOnChain } from "@/lib/marketplace";
import { saveMintedArtwork, markArtworkAsSold, isAuctionSettled, hydrateSales } from "@/lib/artworkCache";
import { useI18n } from "@/lib/i18n";
import { ReputationBadge } from "@/components/auction/ReputationBadge";
import { Loading, Skeleton } from "@/components/ui/Loading";

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
  const { t, L, locale } = useI18n();
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
        hydrateBidSecretsForAuction(id),
        hydrateSales(),
      ]);
      if (data?.id && data.id !== id) await hydrateBidSecretsForAuction(data.id);
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

  // Realtime: re-read the auction the moment its on-chain account changes (new bid, anti-snipe extension, settlement).
  useEffect(() => {
    let subId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const key = new PublicKey(id);
      subId = connection.onAccountChange(key, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(loadAuctionData, 300);
      }, "confirmed");
    } catch {
      // id is not a valid public key; polling still works
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (subId !== null) connection.removeAccountChangeListener(subId).catch(() => {});
    };
  }, [connection, id, loadAuctionData]);

  // Live notices: anti-sniping extension and being outbid
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const prevAuctionRef = useRef<Auction | null>(null);
  useEffect(() => {
    const prev = prevAuctionRef.current;
    if (prev && auction) {
      const me = wallet.publicKey?.toBase58();
      if (auction.endTime && prev.endTime && auction.endTime > prev.endTime) {
        setLiveNotice(L("⏱️ Có bid phút chót — phiên đấu giá được gia hạn thêm 60 giây (chống bid sát giờ).", "⏱️ A last-minute bid extended the auction by 60 seconds (anti-sniping)."));
      } else if (me && prev.highestBidder === me && auction.highestBidder && auction.highestBidder !== me) {
        setLiveNotice(L("⚠️ Bạn vừa bị vượt giá. Tiền cọc 10% đã được hoàn lại tự động.", "⚠️ You were just outbid. Your 10% deposit was refunded automatically."));
      }
    }
    prevAuctionRef.current = auction;
  }, [auction, wallet.publicKey]);

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
      setActionError(L("Ví Phantom đang bị khóa hoặc chưa kết nối. Vui lòng mở tiện ích Phantom, nhập mật khẩu và bấm Kết Nối Ví để tiếp tục.", "Phantom is locked or not connected. Open the Phantom extension, unlock it and click Connect Wallet to continue."));
      return;
    }

    const amount = parseFloat(bidAmountSol);
    const minRequired = parseFloat(minRequiredBid);

    if (isNaN(amount) || amount < minRequired) {
      setActionError(L(`Giá đặt phải lớn hơn hoặc bằng mức tối thiểu: ${minRequired.toFixed(2)} SOL`, `Your bid must be at least the minimum: ${minRequired.toFixed(2)} SOL`));
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
          L(`❌ Điều kiện không hợp lệ: Số dư ví (${balanceSol.toFixed(3)} SOL) phải lớn hơn hoặc bằng 10% (${requiredEligibilitySol.toFixed(3)} SOL) trên tổng số SOL đã đấu giá trên sàn trong tất cả giao dịch (${effectiveTotalPlatformBids.toFixed(3)} SOL).`, `❌ Not eligible: wallet balance (${balanceSol.toFixed(3)} SOL) must be at least 10% (${requiredEligibilitySol.toFixed(3)} SOL) of all SOL bid on the platform (${effectiveTotalPlatformBids.toFixed(3)} SOL).`)
        );
        setIsSubmitting(false);
        return;
      }

      const depositSol = amount * 0.10;
      setActionStatus(L(`Đang chuyển 10% tiền cọc (${depositSol.toFixed(3)} SOL) vào Escrow PDA của sàn...`, `Moving the 10% deposit (${depositSol.toFixed(3)} SOL) into the marketplace escrow PDA...`));
      const amountLamports = Math.floor(amount * 1e9);
      const secret = generateRandomSecret();
      const { commitmentHex } = await computeCommitmentHash(amountLamports, secret);

      const auctionPubkey = new PublicKey(auction.id);

      // Real on-chain bid: transfers 10% deposit into the escrow PDA via the Anchor
      // program and auto-refunds the previous highest bidder's deposit (place_bid.rs).
      const txHash = await placeBidOnChain(connection, wallet, auctionPubkey, amountLamports);

      // Keep a local record for the bid-history feed shown in the UI
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

      setLastTxHash(txHash);
      setActionStatus(L(`✓ Đặt giá ${amount.toFixed(2)} SOL thành công! Đã nạp 10% cọc (${depositSol.toFixed(3)} SOL) an toàn vào Smart Contract Escrow.`, `✓ Bid of ${amount.toFixed(2)} SOL placed! The 10% deposit (${depositSol.toFixed(3)} SOL) is safely locked in the smart contract escrow.`));
      setBidAmountSol("");
      await loadAuctionData();
    } catch (err: any) {
      console.error("Place bid error:", err);
      const errStr = String(err?.message || "") + " " + JSON.stringify(err?.logs || []) + " " + String(err);
      if (errStr.includes("not connected") || errStr.includes("WalletSignTransactionError") || errStr.includes("User rejected")) {
        let msg = L("Ví Phantom đang bị khóa hoặc ngắt kết nối. Vui lòng mở khóa Phantom để ký giao dịch nạp 10% cọc.", "Phantom is locked or disconnected. Unlock Phantom to sign the 10% deposit transaction.");
        if (errStr.includes("User rejected")) {
          msg = L("Bạn đã hủy yêu cầu ký nạp 10% cọc trên ví Phantom.", "You cancelled the 10% deposit signature in Phantom.");
        }
        setActionError(msg);
      } else {
        let msg = err?.message || L("Giao dịch đặt giá & nạp cọc thất bại. Vui lòng thử lại.", "Bid and deposit failed. Please try again.");
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
    setActionStatus(L(`Đang thanh toán 90% còn lại (${remaining90Num.toFixed(2)} SOL) & Hoàn tất nhận quyền sở hữu NFT...`, `Paying the remaining 90% (${remaining90Num.toFixed(2)} SOL) and receiving the NFT...`));

    try {
      const auctionPubkey = new PublicKey(auction.id);

      // Real on-chain settlement: transfers the remaining balance, splits fee/seller
      // proceeds, and moves the NFT to the winner, all via CPI (pay_balance.rs).
      const tx = await payAuctionBalance(connection, wallet, auctionPubkey);

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
          title: auction.title || L(`Tác phẩm Đấu Giá #${auction.nftMint.slice(0, 4)}`, `Auction artwork #${auction.nftMint.slice(0, 4)}`),
          description: L(`Tác phẩm NFT thắng cuộc từ phiên đấu giá MINTLY với mức giá ${currentBidNum.toFixed(2)} SOL (Đã cọc 10%: ${deposit10Num.toFixed(2)} SOL + thanh toán 90%: ${remaining90Num.toFixed(2)} SOL).`, `NFT won in a MINTLY auction at ${currentBidNum.toFixed(2)} SOL (10% deposit: ${deposit10Num.toFixed(2)} SOL + 90% payment: ${remaining90Num.toFixed(2)} SOL).`),
          imageUrl: auction.image || "/assets/hero-artwork.png",
          creator: wallet.publicKey.toBase58(),
          createdAt: Date.now(),
          category: L("Đấu Giá Thắng Cuộc", "Auction won"),
          rarity: "collector",
        });
      }

      setActionStatus(L(`🎉 ĐẤU GIÁ THÀNH CÔNG! Đã thanh toán 90% còn lại (${remaining90Num.toFixed(2)} SOL) + giải phóng 10% cọc (${deposit10Num.toFixed(2)} SOL), NFT đã được chuyển sang ví của bạn.`, `🎉 AUCTION WON! Paid the remaining 90% (${remaining90Num.toFixed(2)} SOL) and released the 10% deposit (${deposit10Num.toFixed(2)} SOL). The NFT is now in your wallet.`));
      setCurrentPhase("SETTLED");
      setAuction((prev) => (prev ? { ...prev, status: "SETTLED" } : prev));
      await loadAuctionData();
    } catch (err: any) {
      console.error("Payment error:", err);
      setActionError(err.message || L("Thanh toán thất bại.", "Payment failed."));
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
    setActionStatus(L(`Đang xử phạt bùng kèo & rút ${penaltySol} SOL tiền cọc từ Escrow...`, `Penalising the no-show and releasing ${penaltySol} SOL of deposit from escrow...`));

    try {
      const auctionPubkey = new PublicKey(auction.id);

      // Forfeits the winner's deposit on-chain to the marketplace's configured
      // forfeiture recipient (default_winner.rs) — not automatically to the seller.
      const tx = await defaultWinnerOnChain(connection, wallet, auctionPubkey);

      setLastTxHash(tx);
      setActionStatus(L(`✓ Xử phạt thành công! Đã thu hồi ${penaltySol} SOL tiền cọc bùng kèo từ Escrow vào quỹ xử phạt của sàn.`, `✓ Penalty applied! ${penaltySol} SOL of forfeited deposit was released from escrow.`));
      await loadAuctionData();
    } catch (err: any) {
      console.error("Penalty claim error:", err);
      setActionError(err.message || L("Xử phạt bùng kèo thất bại.", "Applying the no-show penalty failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handler: Seller cancels their own auction (only allowed while no bids have been placed)
  async function handleCancelAuction() {
    if (!wallet.publicKey || !wallet.signTransaction || !auction) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionStatus(L("Đang hủy phiên đấu giá & rút NFT về ví của bạn...", "Cancelling the auction and returning the NFT to your wallet..."));

    try {
      const auctionPubkey = new PublicKey(auction.id);
      const tx = await cancelAuctionOnChain(connection, wallet, auctionPubkey);

      setLastTxHash(tx);
      setActionStatus(L("✓ Đã hủy phiên đấu giá thành công! NFT đã được chuyển về ví của bạn.", "✓ Auction cancelled! The NFT is back in your wallet."));
      await loadAuctionData();
    } catch (err: any) {
      console.error("Cancel auction error:", err);
      setActionError(err.message || L("Hủy phiên đấu giá thất bại.", "Cancelling the auction failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a09] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center py-32">
          <Loading label={L("Đang tải dữ liệu đấu giá Realtime On-chain...", "Loading realtime on-chain auction data...")} />
        </main>
        <Footer />
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0a0a09] text-text">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-6 py-32 text-center">
          <section className="max-w-lg rounded-3xl border border-white/10 bg-[#121211] p-10 backdrop-blur-xl">
            <h1 className="font-display text-3xl text-text">{L("Không Tìm Thấy Đấu Giá", "Auction not found")}</h1>
            <p className="mt-3 text-sm text-text-dim">
              {L("Phiên đấu giá này không tồn tại hoặc đã bị hủy trên Solana Devnet.", "This auction does not exist or was cancelled on Solana Devnet.")}
            </p>
            <Link
              href="/auctions"
              className="mt-6 inline-flex rounded-full bg-accent px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#0a0a09]"
            >
              {L("Về Danh Sách Đấu Giá", "Back to all auctions")}
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
      return `${d} ${L("ngày", "d")} ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
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
          amountSol: c.revealedAmountSol || L("Đã Cam Kết", "Committed"),
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
    ? `${paymentDaysText} ${L("ngày", "days")}${paymentHoursText > 0 ? ` ${paymentHoursText} ${L("giờ", "h")}` : ""}`
    : `${paymentHoursText || 48} ${L("giờ", "hours")}`;

  const totalBidsCount = Math.max(allBidsList.length, commitments.length);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a09] text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pt-28 lg:px-16">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/auctions"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-dim hover:text-white"
          >
            <span>←</span>
            <span>{L("Tất Cả Phiên Đấu Giá", "All auctions")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono text-accent">Solana Devnet Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Artwork Showcase & Provenance */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/15 bg-[#121211] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)]">
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
                  ● {currentPhase === "LIVE" ? L("ĐANG ĐẤU GIÁ REALTIME", "LIVE · REALTIME") : currentPhase === "SETTLED" ? L("ĐÃ HOÀN TẤT & QUYẾT TOÁN", "COMPLETED & SETTLED") : currentPhase === "PAYMENT_PENDING" ? L("HẾT GIỜ • CHỜ THANH TOÁN", "ENDED • AWAITING PAYMENT") : currentPhase}
                </span>
              </div>
            </div>

            {/* Smart Contract Proof Details */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-accent">
                {L("📜 Thông Tin On-Chain & Hợp Đồng Escrow", "📜 On-chain info & escrow contract")}
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
                    <span>{L("Tác Giả (Seller):", "Seller:")}</span>
                    <span className="text-text truncate max-w-[200px]">{auction.seller}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>{L("Tổng Số Lượt Đặt Giá:", "Total bids:")}</span>
                  <span className="text-accent font-bold">{totalBidsCount}{L(" Lượt Bid", " bids")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Realtime Auction Dashboard */}
          <div className="lg:col-span-6 space-y-6">
            {/* Title & Creator */}
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                {L("Đấu Giá Realtime Trực Tiếp", "Live realtime auction")}
              </span>
              <h1 className="mt-2 mega text-[clamp(2.8rem,6vw,5.6rem)] !leading-[0.92] text-text">
                {auction.title}
              </h1>
              <p className="mt-2 text-xs text-text-dim">
                {L("Tác giả: ", "By: ")}<span className="font-mono text-text">{auction.artist}</span>
              </p>
            </div>

            {/* USER PARTICIPATION GLOW CARD */}
            {myBidRecord && (
              <div className="rounded-3xl border border-accent/50 bg-gradient-to-r from-accent/15 via-accent/10 to-accent/5 p-5 backdrop-blur-md shadow-[0_0_35px_rgba(255,77,31,0.2)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/20 text-xl shadow-inner">
                      🎯
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-accent">
                          {L("Bạn Đang Tham Gia Đấu Giá Này", "You are in this auction")}
                        </span>
                        {myBidRecord.bidAmountSol >= effectiveHighestBidNum ? (
                          <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-[10px] font-bold text-green-400 border border-green-500/30">
                            {L("👑 Bạn đang dẫn đầu", "👑 You are leading")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                            {L("⚡ Có người vừa đặt giá cao hơn", "⚡ Someone just outbid you")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-text-dim">
                        {L("Mức giá bạn đã đặt:", "Your bid:")}{" "}
                        <span className="font-mono font-bold text-text">
                          {myBidRecord.bidAmountSol.toFixed(2)} SOL
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-right">
                    <span className="text-[9px] font-mono uppercase text-text-dim block">{L("Giá Của Bạn", "Your bid")}</span>
                    <span className="font-mono text-base font-bold text-accent">
                      {myBidRecord.bidAmountSol.toFixed(2)} SOL
                    </span>
                  </div>
                </div>
              </div>
            )}

            {liveNotice && (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
                <span>{liveNotice}</span>
                <button onClick={() => setLiveNotice(null)} aria-label={L("Đóng", "Close")} className="text-amber/70 hover:text-amber">✕</button>
              </div>
            )}

            {/* Price & Countdown Card */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-text-dim flex items-center gap-1.5">
                    <span>{L("Giá Cao Nhất Hiện Tại (Realtime)", "Current highest bid (realtime)")}</span>
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                      {L("⛓️ On-chain công khai", "⛓️ Public on-chain")}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-4xl text-text">
                    {effectiveHighestBidStr}{" "}
                    <span className="text-2xl text-accent">SOL</span>
                  </div>
                  {auction.highestBidder && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-text-dim">
                      <span className="font-mono">{auction.highestBidder.slice(0, 4)}…{auction.highestBidder.slice(-4)}</span>
                      <ReputationBadge wallet={auction.highestBidder} />
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-text-dim">
                    {currentPhase === "LIVE" ? L("Thời Gian Còn Lại", "Time left") : L("Trạng Thái", "Status")}
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-accent">
                    {currentPhase === "LIVE" ? formatTime(auctionTimeLeft) : currentPhase === "SETTLED" ? L("ĐÃ QUYẾT TOÁN", "SETTLED") : currentPhase === "DEFAULTED" ? L("BÙNG KÈO", "NO-SHOW") : L("ĐÃ CHỐT DEAL", "CLOSED")}
                  </div>
                </div>
              </div>

              {/* LIVE BIDDING FORM */}
              {currentPhase === "LIVE" && (
                <form onSubmit={handlePlaceBid} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                        {L("Số Tiền Muốn Đặt Giá (SOL)", "Your bid (SOL)")}
                      </label>
                      <span className="text-[11px] font-mono text-accent">
                        {L("Tối thiểu: ", "Minimum: ")}{minRequiredBid} SOL
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min={minRequiredBid}
                      placeholder={L(`Nhập từ ${minRequiredBid} SOL trở lên...`, `Enter ${minRequiredBid} SOL or more...`)}
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
                          <span>{L("Ký Cọc 10% Qua Smart Contract Escrow", "Sign a 10% deposit via the smart contract escrow")}</span>
                        </span>
                        <span className="rounded-full bg-accent/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent border border-accent/30">
                          {L("Cọc 10%: ", "10% deposit: ")}{(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL
                        </span>
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-text-dim list-disc list-inside leading-relaxed">
                        <li>
                          {locale === "vi" ? <>Khi bấm Xác Nhận, ví Phantom sẽ trừ <strong>10% tiền cọc ({(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL)</strong> chuyển vào hợp đồng <strong>Escrow PDA</strong> của sàn.</> : <>When you confirm, Phantom moves <strong>a 10% deposit ({(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL)</strong> into the marketplace <strong>escrow PDA</strong>.</>}
                        </li>
                        <li>
                          {locale === "vi" ? <><strong>Tự Động Hoàn Cọc</strong>: Nếu bạn bị người khác đặt giá cao hơn, tiền cọc sẽ được hoàn trả 100% tự động về ví của bạn.</> : <><strong>Automatic refund</strong>: if someone outbids you, your deposit is returned in full to your wallet automatically.</>}
                        </li>
                        <li>
                          {locale === "vi" ? <><strong>Khi Thắng Cuộc</strong>: Bạn chỉ cần thanh toán <strong>90% còn lại ({(parseFloat(bidAmountSol || minRequiredBid) * 0.90).toFixed(2)} SOL)</strong> để nhận NFT.</> : <><strong>If you win</strong>: you only pay the <strong>remaining 90% ({(parseFloat(bidAmountSol || minRequiredBid) * 0.90).toFixed(2)} SOL)</strong> to receive the NFT.</>}
                        </li>
                      </ul>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-wider text-[#0a0a09] transition-all hover:bg-accent-strong hover:shadow-[0_10px_35px_-5px_rgba(255,77,31,0.7)] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="size-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        <span>{L("Đang Chuyển 10% Cọc Vào Escrow...", "Moving the 10% deposit into escrow...")}</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>{L("Xác Nhận Đặt Giá", "Confirm bid")} {bidAmountSol ? `${bidAmountSol} SOL` : ""} ({L("Nạp Cọc 10%", "10% deposit")}: {(parseFloat(bidAmountSol || minRequiredBid) * 0.10).toFixed(3)} SOL)</span>
                      </>
                    )}
                  </button>

                  {!hasBidsPlaced && wallet.publicKey && auction.seller && wallet.publicKey.toBase58().toLowerCase() === auction.seller.toLowerCase() && (
                    <button
                      type="button"
                      onClick={handleCancelAuction}
                      disabled={isSubmitting}
                      className="w-full rounded-full border border-red-500/30 bg-red-500/5 py-3 text-xs font-semibold text-red-300 transition-all hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {L("Hủy Phiên Đấu Giá & Nhận Lại NFT", "Cancel auction & take the NFT back")}
                    </button>
                  )}
                </form>
              )}

              {/* PAYMENT PENDING PHASE (CHỐT DEAL & THANH TOÁN 90% CÒN LẠI) */}
              {currentPhase === "PAYMENT_PENDING" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-accent/30 bg-accent/10 p-5 text-xs text-accent-strong space-y-3">
                    <div className="font-bold flex items-center gap-2 text-base text-accent-strong">
                      <span>🏆</span>
                      <span>{L("Phiên Đấu Giá Đã Chốt Deal!", "Auction closed!")}</span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-accent/20 font-mono text-xs">
                      <div className="flex justify-between text-text-dim">
                        <span>{L("Giá Thắng Cuộc (100%):", "Winning price (100%):")}</span>
                        <span className="text-text text-sm font-bold">
                          {effectiveHighestBidStr} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-green-400">
                        <span>{L("Tiền Cọc 10% Đã Nạp Sẵn Vào Escrow:", "10% deposit already in escrow:")}</span>
                        <span className="font-bold">
                          -{(effectiveHighestBidNum * 0.10).toFixed(2)} SOL ✓
                        </span>
                      </div>
                      <div className="flex justify-between text-accent pt-1 border-t border-white/5 font-bold text-sm">
                        <span>{L("Số Tiền Cần Thanh Toán Ngay (90%):", "Amount due now (90%):")}</span>
                        <span className="text-base font-display">
                          {(effectiveHighestBidNum * 0.90).toFixed(2)} SOL
                        </span>
                      </div>
                      <div className="flex justify-between text-text-dim pt-1">
                        <span>{L("Hạn Chót Thanh Toán:", "Payment deadline:")}</span>
                        <span className="font-mono text-accent font-bold">
                          {formatTime(paymentTimeLeft)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-300">
                        <span>⚠️</span>
                        <span>{L("Quy Định Xử Phạt Bùng Kèo 10% Cọc", "No-show rule: 10% deposit forfeited")}</span>
                      </div>
                      <p className="leading-relaxed">
                        {locale === "vi" ? <>Người thắng phải thanh toán <strong>90% còn lại ({(effectiveHighestBidNum * 0.90).toFixed(2)} SOL)</strong> trước hạn chót. Nếu quá hạn không thanh toán, <strong>10% tiền cọc ({(effectiveHighestBidNum * 0.10).toFixed(3)} SOL)</strong> đang giữ trong Escrow sẽ được chia: 70% bồi thường cho Seller, 30% vào quỹ sàn.</> : <>The winner must pay the <strong>remaining 90% ({(effectiveHighestBidNum * 0.90).toFixed(2)} SOL)</strong> before the deadline. If they do not, the <strong>10% deposit ({(effectiveHighestBidNum * 0.10).toFixed(3)} SOL)</strong> held in escrow is split: 70% compensates the seller, 30% goes to the platform.</>}
                      </p>
                    </div>
                  </div>

                  {isWinner ? (
                    <button
                      onClick={handlePayFullPaymentAndSettle}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-accent py-4 text-xs font-bold uppercase tracking-wider text-[#0a0a09] hover:bg-accent-strong shadow-[0_10px_35px_-5px_rgba(255,77,31,0.8)] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="size-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          <span>{L("Đang Quyết Toán 90% & Nhận NFT...", "Settling 90% and receiving the NFT...")}</span>
                        </>
                      ) : (
                        <>
                          <span>🚀</span>
                          <span>{L("Thanh Toán 90% Còn Lại", "Pay the remaining 90%")} ({(effectiveHighestBidNum * 0.90).toFixed(2)} SOL) &amp; {L("Nhận NFT Ngay", "receive the NFT")}</span>
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
                      <span>{L("Phạt Bùng Kèo: Chia 10% Cọc", "Penalise no-show: split the 10% deposit")} ({(effectiveHighestBidNum * 0.10).toFixed(3)} SOL)</span>
                    </button>
                  ) : (
                    <p className="text-center text-xs text-text-dim">
                      {L("Đang chờ Người Thắng Cuộc hoàn tất thanh toán 90% còn lại để chuyển giao quyền sở hữu NFT...", "Waiting for the winner to pay the remaining 90% so ownership of the NFT can transfer...")}
                    </p>
                  )}
                </div>
              )}

              {/* SETTLED PHASE */}
              {currentPhase === "SETTLED" && (
                <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-center space-y-3">
                  <div className="text-3xl">🎉</div>
                  <h3 className="font-display text-xl text-green-300">
                    {L("Phiên Đấu Giá Đã Quyết Toán Xong!", "Auction settled!")}
                  </h3>
                  <p className="text-xs text-text-dim">
                    {L("Quyền sở hữu NFT đã được chuyển thành công tới Winner on-chain. Tiền bán đã được chuyển tới Seller.", "Ownership of the NFT has moved to the winner on-chain. The proceeds went to the seller.")}
                  </p>
                  {auction.nftMint && (
                    <Link
                      href={`/passport/${auction.nftMint}`}
                      className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0a0a09] hover:bg-accent-strong"
                    >
                      <span>🛡️</span>
                      <span>{L("Xem NFT Passport Mới Nhất", "View the latest NFT passport")}</span>
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
                  <span className="text-text-dim">{L("Giao Dịch On-Chain: ", "On-chain transaction: ")}</span>
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

            {/* Bids History Feed (public — bid amounts are visible on-chain in realtime) */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md space-y-4">
              <h3 className="font-display text-lg text-text flex items-center justify-between">
                <span>{L("Lịch Sử Đặt Giá (", "Bid history (")}{allBidsList.length})</span>
                <span className="text-xs font-mono text-accent">{L("⛓️ On-chain công khai", "⛓️ Public on-chain")}</span>
              </h3>

              {allBidsList.length === 0 ? (
                <p className="text-xs text-text-dim">{L("Chưa có lượt đặt giá nào. Hãy là người đầu tiên đặt giá!", "No bids yet. Be the first to bid!")}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {allBidsList.map((c, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                        c.isMe
                          ? "border-accent/40 bg-accent/[0.08] shadow-[0_0_15px_rgba(255,77,31,0.1)]"
                          : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${c.isMe ? "bg-accent animate-pulse" : "bg-white/40"}`} />
                        <span className={`font-medium ${c.isMe ? "text-accent font-bold" : "text-text"}`}>
                          {L("Người Đấu Giá #", "Bidder #")}{allBidsList.length - idx}
                          {c.isMe && (
                            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent border border-accent/30">
                              {L("Bạn", "You")}
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
