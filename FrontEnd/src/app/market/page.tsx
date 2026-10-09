"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchLiveListings, fetchLiveAuctions, type Auction } from "@/lib/data";
import type { Artwork } from "@/components/explore/ArtworkCard";

export default function MarketPage() {
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
    <div className="flex min-h-screen flex-col bg-[#f6f7fb] text-slate-950">
      <Navbar />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-24 sm:px-6 md:px-10 md:pt-32 lg:px-16">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_22px_70px_-40px_rgba(15,23,42,0.55)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-10 lg:p-12">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
                Thị trường mua ngay
              </p>
              <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.7rem,6vw,5.8rem)] leading-[0.9] text-slate-950">
                Mua tranh giá cố định trên Solana
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Người bán đặt một mức giá cứng, người mua thanh toán trực tiếp. Smart contract tự chia 5% phí sàn và 95% còn lại cho seller.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  ["Tin đang bán", `${listings.length}`],
                  ["Giá sàn", floorPrice > 0 ? `${floorPrice.toFixed(2)} SOL` : "0.00 SOL"],
                  ["Đấu giá live", `${auctions.length}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
                    <div className="mt-2 font-display text-2xl text-slate-950">{loading ? "..." : value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/portfolio"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-transform hover:-translate-y-0.5"
                >
                  Đăng bán từ kho
                </Link>
                <Link
                  href="/auctions"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:text-slate-950"
                >
                  Xem đấu giá
                </Link>
              </div>
            </div>

            <div className="relative min-h-[360px] bg-slate-900">
              <Image
                src="/assets/digital-renaissance.png"
                alt="Mintly marketplace artwork"
                fill
                priority
                sizes="(max-width:1024px) 100vw, 45vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/15 bg-white/90 p-4 text-slate-950 shadow-xl backdrop-blur-md">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-violet-600">Ví dụ phí</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-slate-500">Giá</div>
                    <div className="font-mono font-bold">100</div>
                  </div>
                  <div>
                    <div className="text-slate-500">App</div>
                    <div className="font-mono font-bold">5</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Seller</div>
                    <div className="font-mono font-bold">95</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
                Tác phẩm đang bán
              </p>
              <h2 className="mt-1 font-display text-3xl text-slate-950 sm:text-4xl">
                Chọn tranh và mua ngay
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              Đang đồng bộ listing từ Solana...
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h3 className="font-display text-2xl text-slate-950">Chưa có tranh đăng bán</h3>
              <p className="mt-2 text-sm text-slate-500">
                Vào kho tác phẩm để đăng bán giá cố định đầu tiên.
              </p>
              <Link
                href="/portfolio"
                className="mt-6 inline-flex rounded-full bg-slate-950 px-6 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white"
              >
                Vào kho tác phẩm
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((item) => (
                <Link
                  key={item.id}
                  href={item.href || `/listings/${item.id}`}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_70px_-34px_rgba(15,23,42,0.5)]"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width:768px) 100vw, 25vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700 backdrop-blur">
                      Mua ngay
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-1 font-display text-xl text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Seller {item.artist}</p>
                    <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                      <span className="text-xs font-semibold text-slate-500">Giá bán</span>
                      <span className="font-mono text-sm font-bold text-slate-950">{item.price}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
