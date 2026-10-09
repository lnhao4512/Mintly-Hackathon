"use client";

import { LineIcon } from "@/components/ui/LineIcon";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { getMarketplaceProgram } from "@/utils/anchor";
import { assertAuctionCanBeCreated } from "@/lib/marketplace";
import {
  MARKETPLACE_FEE_BPS,
  WSOL_MINT,
  getAuctionEscrowAuthorityPda,
  getAuctionPda,
  getConfigPda,
  getTokenConfigPda,
} from "@/lib/config";
import type { MintedArtworkRecord } from "@/lib/artworkCache";
import { clearBidsForAuction } from "@/lib/auction-crypto";
import { useI18n } from "@/lib/i18n";

interface CreateAuctionModalProps {
  artwork: MintedArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CreateAuctionModal({
  artwork,
  isOpen,
  onClose,
}: CreateAuctionModalProps) {
  const { L } = useI18n();
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [startPriceSol, setStartPriceSol] = useState("0.1");
  const [minIncrementSol, setMinIncrementSol] = useState("0.05");

  // Auction Duration: Ngày / Giờ / Phút
  const [auctionDays, setAuctionDays] = useState("1");
  const [auctionHours, setAuctionHours] = useState("0");
  const [auctionMinutes, setAuctionMinutes] = useState("0");

  // Payment Deadline: Ngày / Giờ / Phút (Mặc định 2 ngày)
  const [paymentDays, setPaymentDays] = useState("2");
  const [paymentHours, setPaymentHours] = useState("0");
  const [paymentMinutes, setPaymentMinutes] = useState("0");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [auctionAddress, setAuctionAddress] = useState<string | null>(null);

  if (!isOpen || !artwork) return null;

  // Convert (Days, Hours, Minutes) to total seconds
  function toTotalSeconds(d: string, h: string, m: string): number {
    const days = Math.max(0, parseInt(d || "0", 10) || 0);
    const hours = Math.max(0, parseInt(h || "0", 10) || 0);
    const mins = Math.max(0, parseInt(m || "0", 10) || 0);
    return days * 86400 + hours * 3600 + mins * 60;
  }

  async function handleCreateAuction(e: React.FormEvent) {
    e.preventDefault();
    if (!artwork) return;
    if (!wallet.publicKey || !wallet.signTransaction) {
      setErrorMsg(L("Vui lòng kết nối ví Solana trước khi tạo đấu giá.", "Please connect a Solana wallet before creating an auction."));
      return;
    }

    const startPrice = parseFloat(startPriceSol);
    const minInc = parseFloat(minIncrementSol);

    const auctionSecs = toTotalSeconds(auctionDays, auctionHours, auctionMinutes);
    const paymentSecs = toTotalSeconds(paymentDays, paymentHours, paymentMinutes);

    if (isNaN(startPrice) || startPrice <= 0) {
      setErrorMsg(L("Giá khởi điểm phải lớn hơn 0 SOL.", "The starting price must be greater than 0 SOL."));
      return;
    }
    if (auctionSecs < 60) {
      setErrorMsg(L("Thời gian đấu giá tối thiểu là 1 phút.", "The auction must last at least 1 minute."));
      return;
    }
    if (paymentSecs < 60) {
      setErrorMsg(L("Thời hạn thanh toán sau khi thắng tối thiểu là 1 phút.", "The payment window after winning must be at least 1 minute."));
      return;
    }

    const seller = wallet.publicKey;
    const nftMint = new PublicKey(artwork.mintAddress);
    const [auctionPda] = getAuctionPda(nftMint);

    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 5; // buffer 5 seconds to ensure LIVE status immediately
    const endTime = now + auctionSecs;
    const revealDeadline = endTime + 1; // Direct auction: reveal is immediate at endTime + 1
    const depositDeadline = endTime + paymentSecs;
    const paymentDeadline = depositDeadline + 1;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessTx(null);

    try {
      // Pre-check: Verify that the NFT Mint exists on Solana Devnet
      const mintInfo = await connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        setErrorMsg(
          L(`Tác phẩm "${artwork.title}" (Mint: ${artwork.mintAddress}) chưa được Mint on-chain thực tế trên Solana Devnet. Vui lòng vào trang Tạo Tác Phẩm (/create) để Mint tác phẩm lên mạng trước khi đưa lên sàn đấu giá.`, `The artwork "${artwork.title}" (Mint: ${artwork.mintAddress}) has not actually been minted on Solana Devnet. Go to Create (/create) and mint it before listing it for auction.`)
        );
        setIsSubmitting(false);
        return;
      }

      const sellerTokenAccount = getAssociatedTokenAddressSync(nftMint, seller);
      const ataInfo = await connection.getAccountInfo(sellerTokenAccount);
      if (!ataInfo) {
        setErrorMsg(
          L(`Ví của bạn chưa sở hữu tài khoản Token Account cho NFT này trên Solana Devnet. Vui lòng kiểm tra lại quyền sở hữu.`, `Your wallet has no token account for this NFT on Solana Devnet. Please check ownership.`)
        );
        setIsSubmitting(false);
        return;
      }

      await assertAuctionCanBeCreated(connection, nftMint);

      const program = getMarketplaceProgram(connection, wallet);

      const [configPda] = getConfigPda();
      const [tokenConfigPda] = getTokenConfigPda(configPda, WSOL_MINT);
      const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
      const escrowNftAccount = Keypair.generate();

      const startPriceLamports = Math.floor(startPrice * 1e9);
      const minIncrementLamports = Math.floor(minInc * 1e9);

      const ix = await program.methods
        .createAuction(
          new BN(startPriceLamports),
          new BN(minIncrementLamports),
          new BN(startTime),
          new BN(endTime),
          new BN(revealDeadline),
          new BN(depositDeadline),
          new BN(paymentDeadline)
        )
        .accounts({
          seller,
          config: configPda,
          tokenConfig: tokenConfigPda,
          nftMint,
          paymentMint: WSOL_MINT,
          sellerTokenAccount,
          auction: auctionPda,
          escrowAuthority,
          escrowTokenAccount: escrowNftAccount.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .instruction();

      // 1. Auto-init Marketplace Config on Devnet if this is the first deployment
      const instructions: any[] = [];
      const configInfo = await connection.getAccountInfo(configPda);
      if (!configInfo) {
        const initIx = await (program.methods as any)
          .initializeMarketplace(seller, seller, MARKETPLACE_FEE_BPS)
          .accounts({
            authority: seller,
            config: configPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        instructions.push(initIx);
      }

      // 2. Auto-whitelist WSOL/SOL Payment Mint if needed
      const tokenConfigInfo = await connection.getAccountInfo(tokenConfigPda);
      if (!tokenConfigInfo) {
        const addTokenIx = await (program.methods as any)
          .addToken(WSOL_MINT, 9)
          .accounts({
            authority: seller,
            config: configPda,
            tokenConfig: tokenConfigPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        instructions.push(addTokenIx);
      }

      // 3. Add createAuction instruction. The Anchor program supports re-initializing
      // the same Auction PDA for a resale round as long as the previous round is
      // SETTLED or CANCELLED (see create_auction.rs) — no client-side special-casing
      // needed; a still-active previous round will legitimately fail on-chain below.
      instructions.push(ix);

      // 4. Fetch the freshest blockhash right before signing
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: seller,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      instructions.forEach((instruction) => tx.add(instruction));

      // Send transaction with wallet adapter + escrow Keypair signer
      const signature = await wallet.sendTransaction(tx, connection, {
        signers: [escrowNftAccount],
        skipPreflight: false,
      });

      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      // Clear previous round bids for this auction/mint
      clearBidsForAuction(auctionPda.toBase58());
      clearBidsForAuction(artwork.mintAddress);

      setSuccessTx(signature);
      setAuctionAddress(auctionPda.toBase58());

      setTimeout(() => {
        router.push(`/auctions/${auctionPda.toBase58()}`);
      }, 1500);
    } catch (err: any) {
      console.warn("Create auction error:", err);
      const errStr = String(err?.message || "") + " " + JSON.stringify(err?.logs || []) + " " + String(err);

      let msg = err?.message || L("Giao dịch tạo đấu giá thất bại. Vui lòng kiểm tra ví.", "Creating the auction failed. Please check your wallet.");
      if (errStr.includes("AuctionStillActive") || errStr.includes("6010")) {
        msg = L("Phiên đấu giá trước đó cho tác phẩm này vẫn chưa kết thúc/hủy trên Solana, chưa thể mở vòng đấu giá lại.", "The previous auction for this artwork has not ended or been cancelled on Solana, so a new round cannot open yet.");
      } else if (errStr.includes("Blockhash not found")) {
        msg = L("Phiên giao dịch đã hết hạn xác thực (Blockhash expired do để popup ví quá lâu). Vui lòng bấm 'Kích Hoạt Phiên Đấu Giá' và bấm 'Xác nhận' trên ví trong vòng 60 giây.", "The transaction expired (blockhash expired because the wallet popup stayed open too long). Press 'Activate auction' again and confirm in your wallet within 60 seconds.");
      } else if (errStr.includes("already in use")) {
        msg = err?.message;
      } else if (errStr.includes("User rejected") || errStr.includes("WalletSignTransactionError")) {
        msg = L("Bạn đã hủy yêu cầu ký giao dịch tạo đấu giá trên ví Phantom.", "You cancelled the auction signature in Phantom.");
      }
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#121211] p-6 text-text shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)] sm:p-8 max-h-[90vh] overflow-y-auto overscroll-contain" data-lenis-prevent>
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-text-dim transition-colors hover:border-white/30 hover:text-white"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-accent/20 text-xl text-accent">
            <LineIcon name="hammer" className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl text-text">
              {L("Khởi Tạo Đấu Giá On-chain", "Create an on-chain auction")}
            </h2>
            <p className="text-xs text-text-dim">
              {L("Lấy tác phẩm từ Kho • Khóa NFT vào Escrow PDA • Cơ chế Commit-Reveal", "Take the artwork from your vault • Lock the NFT in an escrow PDA • Public English auction")}
            </p>
          </div>
        </div>

        {/* Selected NFT Preview */}
        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-black border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="size-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent">
              {L("Tác phẩm từ Kho cá nhân", "Artwork from your vault")}
            </span>
            <h3 className="mt-1 font-display text-base text-text truncate">
              {artwork.title}
            </h3>
            <p className="font-mono text-xs text-text-dim truncate">
              Mint: {artwork.mintAddress}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateAuction} className="mt-6 space-y-5">
          {/* Price config */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-dim">
                {L("Giá Khởi Điểm (SOL) *", "Starting price (SOL) *")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={startPriceSol}
                onChange={(e) => setStartPriceSol(e.target.value)}
                required
                disabled={isSubmitting}
                className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                placeholder="0.10"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-dim">
                {L("Bước Nhảy Tối Thiểu (SOL)", "Minimum increment (SOL)")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={minIncrementSol}
                onChange={(e) => setMinIncrementSol(e.target.value)}
                disabled={isSubmitting}
                className="mt-1.5 w-full rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 font-mono text-sm text-text outline-none focus:border-accent"
                placeholder="0.05"
              />
            </div>
          </div>

          {/* Time config: Ngày / Giờ / Phút */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <LineIcon name="clock" className="size-4" />
                <span>{L("Cấu Hình Thời Gian (Ngày / Giờ / Phút)", "Timing (days / hours / minutes)")}</span>
              </h4>
            </div>

            {/* 1. Auction Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text">
                  {L("1. Thời Gian Đấu Giá (Hết giờ là chốt deal)", "1. Auction length (the deal closes when time runs out)")}
                </label>
                <div className="flex gap-1">
                  {[
                    { label: L("10 Phút", "10 min"), d: "0", h: "0", m: "10" },
                    { label: L("1 Giờ", "1 hour"), d: "0", h: "1", m: "0" },
                    { label: L("1 Ngày", "1 day"), d: "1", h: "0", m: "0" },
                    { label: L("3 Ngày", "3 days"), d: "3", h: "0", m: "0" },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => {
                        setAuctionDays(p.d);
                        setAuctionHours(p.h);
                        setAuctionMinutes(p.m);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-text-dim hover:bg-white/10 hover:text-white"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Ngày", "Days")}</label>
                  <input
                    type="number"
                    min="0"
                    value={auctionDays}
                    onChange={(e) => setAuctionDays(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Giờ", "Hours")}</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={auctionHours}
                    onChange={(e) => setAuctionHours(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Phút", "Minutes")}</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={auctionMinutes}
                    onChange={(e) => setAuctionMinutes(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 2. Payment Deadline Config */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text">
                  {L("2. Hạn Chót Thanh Toán Sau Khi Thắng", "2. Payment deadline after winning")}
                </label>
                <div className="flex gap-1">
                  {[
                    { label: L("1 Giờ", "1 hour"), d: "0", h: "1", m: "0" },
                    { label: L("1 Ngày", "1 day"), d: "1", h: "0", m: "0" },
                    { label: L("2 Ngày", "2 days"), d: "2", h: "0", m: "0" },
                    { label: L("3 Ngày", "3 days"), d: "3", h: "0", m: "0" },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.label}
                      onClick={() => {
                        setPaymentDays(p.d);
                        setPaymentHours(p.h);
                        setPaymentMinutes(p.m);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-text-dim hover:bg-white/10 hover:text-white"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Ngày", "Days")}</label>
                  <input
                    type="number"
                    min="0"
                    value={paymentDays}
                    onChange={(e) => setPaymentDays(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="2"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Giờ", "Hours")}</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={paymentHours}
                    onChange={(e) => setPaymentHours(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-text-dim mb-1">{L("Phút", "Minutes")}</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={paymentMinutes}
                    onChange={(e) => setPaymentMinutes(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-center font-mono text-xs text-text outline-none focus:border-accent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* 3. Quy chế Thanh Toán 100% & Phạt 10% Quá Hạn */}
            <div className="space-y-2 pt-3 border-t border-white/5">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <LineIcon name="shield" className="size-4" />
                  <span>{L("Quy Định Thanh Toán 100% & Phạt 10% Quá Hạn", "Payment rules: 100% due, 10% forfeited if late")}</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  {L("Sau khi hết giờ đấu giá, người thắng phải thanh toán 100% số tiền đã đấu giá trong thời hạn đã thiết lập để nhận NFT. Chỉ khi không trả đúng hạn thì người thắng mới bị phạt mất 10% số tiền trên tổng số tiền đã đấu giá (70% bồi thường cho tác giả)!", "After the auction ends, the winner must pay 100% of the winning bid within the deadline to receive the NFT. Only if they fail to pay on time do they lose 10% of the bid (70% of it compensates the artist)!")}
                </p>
              </div>
            </div>
          </div>

          {/* Success Notification */}
          {successTx && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-xs text-green-300 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <span>✓</span>{L(" Đã khởi tạo đấu giá thành công trên Solana!", " Auction created on Solana!")}
              </div>
              <div className="font-mono text-[11px] break-all">
                Tx: {successTx}
              </div>
              {auctionAddress && (
                <div className="font-mono text-[11px] text-accent">
                  Auction PDA: {auctionAddress}
                </div>
              )}
              <p className="text-[11px] text-text-dim animate-pulse">
                {L("Đang chuyển hướng đến trang đấu giá...", "Redirecting to the auction page...")}
              </p>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-white/15 px-6 py-3 text-xs font-semibold text-text-dim hover:bg-white/5 hover:text-white"
            >
              {L("Hủy Bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-bold uppercase tracking-wider text-[#0a0a09] transition-all hover:bg-accent-strong hover:shadow-[0_10px_30px_-5px_rgba(255,77,31,0.7)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  <span>{L("Đang Khởi Tạo Đấu Giá...", "Creating the auction...")}</span>
                </>
              ) : (
                <>
                  <LineIcon name="rocket" className="size-4" />
                  <span>{L("Tạo Đấu Giá Ngay", "Create auction now")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
