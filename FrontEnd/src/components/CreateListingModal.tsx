"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { createListingOnChain } from "@/lib/marketplace";
import { MARKETPLACE_FEE_BPS } from "@/lib/config";
import type { MintedArtworkRecord } from "@/lib/artworkCache";
import { useI18n } from "@/lib/i18n";

interface CreateListingModalProps {
  artwork: MintedArtworkRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

function toLamports(sol: number) {
  return Math.floor(sol * 1e9);
}

export function CreateListingModal({ artwork, isOpen, onClose }: CreateListingModalProps) {
  const { L } = useI18n();
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [priceSol, setPriceSol] = useState("1");
  const [durationDays, setDurationDays] = useState("7");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);

  if (!isOpen || !artwork) return null;

  const parsedPrice = Number(priceSol);
  const feeSol = Number.isFinite(parsedPrice) ? (parsedPrice * MARKETPLACE_FEE_BPS) / 10_000 : 0;
  const sellerReceives = Number.isFinite(parsedPrice) ? Math.max(parsedPrice - feeSol, 0) : 0;

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    if (!artwork) return;
    if (!wallet.publicKey || !wallet.signTransaction) {
      setErrorMsg(L("Vui lòng kết nối ví Solana trước khi đăng bán.", "Please connect a Solana wallet before listing."));
      return;
    }

    const price = Number(priceSol);
    const days = Math.max(1, Number.parseInt(durationDays || "7", 10) || 7);

    if (!Number.isFinite(price) || price <= 0) {
      setErrorMsg(L("Giá bán phải lớn hơn 0 SOL.", "The price must be greater than 0 SOL."));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessTx(null);

    try {
      const nftMint = new PublicKey(artwork.mintAddress);
      const mintInfo = await connection.getAccountInfo(nftMint);
      if (!mintInfo) {
        setErrorMsg(L("NFT mint chưa tồn tại trên Solana Devnet. Vui lòng kiểm tra lại tác phẩm.", "This NFT mint does not exist on Solana Devnet. Please check the artwork."));
        return;
      }

      const expiryUnix = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
      const result = await createListingOnChain(
        connection,
        wallet,
        nftMint,
        toLamports(price),
        expiryUnix
      );

      setSuccessTx(result.signature);
      setTimeout(() => {
        router.push(`/listings/${result.listingPda}`);
      }, 1200);
    } catch (err: unknown) {
      console.warn("Create listing error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg || L("Giao dịch đăng bán thất bại.", "Listing failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-[#fbfcff] p-6 text-text shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] sm:p-7">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full border border-line bg-bg-elevated text-text-dim transition-colors hover:text-text"
        >
          x
        </button>

        <div className="pr-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
            {L("Bán giá cố định", "Fixed price sale")}
          </p>
          <h2 className="mt-1 font-display text-2xl text-text">
            {L("Đăng bán tác phẩm", "List artwork")}
          </h2>
          <p className="mt-1 text-sm text-text-dim">
            {L("NFT được khóa vào escrow; người mua thanh toán đủ giá niêm yết, sàn thu 5%.", "The NFT is locked in escrow; the buyer pays the full list price and the platform takes 5%.")}
          </p>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-2xl border border-line bg-bg-elevated p-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border border-line bg-white/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artwork.imageUrl} alt={artwork.title} className="size-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg text-text">{artwork.title}</h3>
            <p className="mt-1 truncate font-mono text-xs text-text-dim">
              Mint: {artwork.mintAddress}
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateListing} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-text-dim">
                {L("Giá bán cứng (SOL)", "Fixed price (SOL)")}
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={priceSol}
                onChange={(e) => setPriceSol(e.target.value)}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-2xl border border-line bg-bg-elevated px-4 py-3 font-mono text-sm text-text outline-none transition-colors focus:border-accent"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-text-dim">
                {L("Hiệu lực tin bán", "Listing valid for")}
              </label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                disabled={isSubmitting}
                className="mt-2 w-full rounded-2xl border border-line bg-bg-elevated px-4 py-3 text-sm text-text outline-none transition-colors focus:border-accent"
              >
                <option value="1">{L("1 ngày", "1 day")}</option>
                <option value="3">{L("3 ngày", "3 days")}</option>
                <option value="7">{L("7 ngày", "7 days")}</option>
                <option value="14">{L("14 ngày", "14 days")}</option>
                <option value="30">{L("30 ngày", "30 days")}</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-line bg-accent/10 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold text-accent">{L("Người mua trả", "Buyer pays")}</div>
              <div className="mt-1 font-mono text-base font-bold text-text">
                {Number.isFinite(parsedPrice) ? parsedPrice.toFixed(2) : "0.00"} SOL
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-accent">{L("Phí sàn 5%", "Platform fee 5%")}</div>
              <div className="mt-1 font-mono text-base font-bold text-text">
                {feeSol.toFixed(3)} SOL
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-accent">{L("Seller nhận", "Seller receives")}</div>
              <div className="mt-1 font-mono text-base font-bold text-text">
                {sellerReceives.toFixed(3)} SOL
              </div>
            </div>
          </div>

          {successTx && (
            <div className="rounded-2xl border border-success/30 bg-success/10 p-3 text-xs text-success">
              {L("Đăng bán thành công. Tx: ", "Listed. Tx: ")}<span className="font-mono">{successTx.slice(0, 18)}...</span>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-line bg-bg-elevated px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-text-dim-2 transition-colors hover:text-text"
            >
              {L("Hủy", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-accent text-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
            >
              {isSubmitting ? L("Đang đăng bán...", "Listing...") : L("Đăng bán ngay", "List now")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
