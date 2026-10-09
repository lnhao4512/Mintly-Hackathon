"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/layout/PageHero";
import { FadeUp } from "@/components/motion/Reveal";
import { fetchLiveListings, fetchLiveAuctions, type Auction } from "@/lib/data";
import type { Artwork } from "@/components/explore/ArtworkCard";
import { useI18n } from "@/lib/i18n";
import { Loading, Skeleton } from "@/components/ui/Loading";

export default function MarketPage() {
  const { L } = useI18n();
  const { connection } = useConnection();
  const [listings, setListings] = useState<Artwork[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadMarket() {
      try {
        const [liveListings, liveAuctions] = await Promise.all([
          fetchLiveListings(connection),
          fetchLiveAuctions(connection),
        ]);
        if (!isMounted) return;
        setListings(liveListings);
        setAuctions(liveAuctions.filter((auction) => auction.isLive));
      } catch (err) {
        console.warn("Failed to load market data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadMarket();
    const interval = setInterval(loadMarket, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [connection]);

  const floorPrice = useMemo(() => {
    const prices = listings
      .map((item) => Number(item.price.replace(" SOL", "")))
      .filter((value) => Number.isFinite(value) && value > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [listings]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <PageHero
          eyebrow={L("Thị trường mua ngay", "Buy it now")}
          index={L("01 / Thị trường", "01 / Market")}
          lines={[L("Giá", "Fixed"), <em key="p">{L("cố định", "price")}</em>]}
          description={L("Người bán đặt một mức giá cứng, người mua thanh toán trực tiếp. Smart contract tự chia phí sàn và phần còn lại cho seller trong cùng một giao dịch.", "The seller sets a fixed price and the buyer pays directly. The smart contract splits the platform fee and the remainder to the seller in the same transaction.")}
          actions={
            <>
              <Link href="/portfolio" className="btn">
                {L("Đăng bán từ kho ", "List from your vault ")}<span aria-hidden>→</span>
              </Link>
              <Link href="/auctions" className="btn btn-ghost">
                {L("Xem đấu giá", "View auctions")}
              </Link>
            </>
          }
          stats={[
            { label: L("Tin đang bán", "Listings"), value: loading ? <Skeleton /> : `${listings.length}` },
            { label: L("Giá sàn", "Floor price"), value: loading ? <Skeleton className="w-[6ch]" /> : floorPrice > 0 ? `${floorPrice.toFixed(2)} SOL` : "0.00 SOL" },
            { label: L("Đấu giá live", "Live auctions"), value: loading ? <Skeleton /> : `${auctions.length}` },
          ]}
        />

        {loading ? (
          <Loading label={L("Đang đồng bộ listing từ Solana…", "Syncing listings from Solana…")} />
        ) : listings.length === 0 ? (
          <section className="border border-line px-6 py-28 text-center">
            <p className="mega text-[clamp(4rem,12vw,10rem)] text-text-dim/40">00</p>
            <h2 className="mt-6 font-display text-3xl font-light tracking-[-0.03em]">{L("Chưa có tranh đăng bán", "Nothing listed yet")}</h2>
            <p className="mx-auto mt-3 max-w-md text-text-dim-2">{L("Vào kho tác phẩm để đăng bán giá cố định đầu tiên.", "Open your vault to make the first fixed-price listing.")}</p>
            <Link href="/portfolio" className="btn mt-8">
              {L("Vào kho tác phẩm →", "Open vault →")}
            </Link>
          </section>
        ) : (
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((item, idx) => (
              <FadeUp key={item.id} delay={(idx % 4) * 0.07}>
                <Link href={item.href || `/listings/${item.id}`} className="group block" data-cursor="img">
                  <div className="relative aspect-square overflow-hidden bg-bg-elevated">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width:768px) 100vw, 25vw"
                      className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
                    />
                    <i className="reg left-3 top-3" />
                    <i className="reg right-3 top-3" />
                    <i className="reg bottom-3 left-3" />
                    <i className="reg bottom-3 right-3" />
                    <span className="absolute left-4 top-4 bg-ink/80 px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] backdrop-blur-sm">{L("Mua ngay", "Buy now")}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 border-t border-line pt-3">
                    <span className="font-mono-ui text-[10px] tracking-[0.14em] text-text-dim">№ {String(idx + 1).padStart(2, "0")}</span>
                    <h3 className="truncate font-display text-xl font-light tracking-[-0.03em] transition-colors duration-500 group-hover:text-accent">{item.title}</h3>
                    <span className="font-mono-ui text-sm">{item.price}</span>
                    <span />
                    <span className="eyebrow truncate">Seller {item.artist}</span>
                    <span className="eyebrow text-right">{L("Giá bán", "Price")}</span>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
