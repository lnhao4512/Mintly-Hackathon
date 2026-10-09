"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArtworkCard, type Artwork } from "@/components/explore/ArtworkCard";
import { ProcessVisual } from "@/components/explore/ProcessVisual";
import { Frame3D } from "@/components/explore/Frame3D";
import { Loading, Skeleton } from "@/components/ui/Loading";
import { FadeUp, LineReveal, Marquee, Parallax, useInView } from "@/components/motion/Reveal";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useI18n } from "@/lib/i18n";
import {
  fetchLiveListings,
  fetchLiveAuctions,
  fetchSettledVolumeSol,
  type Auction,
  type MarketplaceStats,
} from "@/lib/data";

const copy = {
  en: {
    meta: "Solana Devnet — 1/1 art auction house",
    h1: ["Art that", <>can <em>prove</em></>, "itself."],
    lede: "Drawn by hand, checked for originality, escrowed on-chain. Every bid carries a 10% deposit — and if a winner walks away, the artist is paid.",
    cta1: "Enter the auctions",
    cta2: "Start drawing",
    stats: ["Live auctions", "Direct listings", "Highest bid", "Settled volume"],
    specimen: "Specimen",
    scanned: "Scanning originality…",
    plateTitle: "Mona Lisa",
    plateMeta: "Leonardo da Vinci · c. 1503",
    marquee: ["Proven by hand", "Escrowed on Solana", "10% deposit", "No-show insured", "Anti-sniping", "1 of 1"],
    processEyebrow: "How a work earns its price",
    process: [
      { t: "Draw", d: "The Studio records your strokes as a time-lapse. Not a screenshot — the making of it." },
      { t: "Prove", d: "AI compares it with everything already minted. The time-lapse hash is anchored on-chain through the SPL Memo program." },
      { t: "Auction", d: "Bids are public and realtime. Each one locks 10% in an escrow PDA; the outbid get it back instantly. Late bids extend the clock." },
      { t: "Settle", d: "Winner pays the remaining 90% and the NFT moves in the same transaction. Walk away, and 70% of the deposit goes to the artist." },
    ],
    galleryEyebrow: "On the wall now",
    galleryTitle: ["Live", "listings"],
    viewAll: "All auctions",
    loading: "Reading the Solana program…",
    emptyTitle: "The wall is empty.",
    emptyText: "Be the first to mint a piece and hang it here.",
    manifestoEyebrow: "The rule",
    manifesto:
      "Back out of a bid and your deposit does not vanish into a fund. It is paid to the artist whose work you walked away from.",
    ctaTitle: ["Make something", "worth proving."],
    ctaButton: "Open the Studio",
  },
  vi: {
    meta: "Solana Devnet — nhà đấu giá nghệ thuật 1/1",
    h1: ["Nghệ thuật", "biết tự", <><em>chứng minh.</em></>],
    lede: "Vẽ bằng tay, kiểm tra nguyên bản, ký quỹ on-chain. Mỗi lượt đặt giá khóa 10% tiền cọc — và nếu người thắng bùng kèo, nghệ sĩ được bồi thường.",
    cta1: "Vào phòng đấu giá",
    cta2: "Bắt đầu vẽ",
    stats: ["Đấu giá đang mở", "Đang bán", "Giá cao nhất", "Đã thanh toán"],
    specimen: "Mẫu vật",
    scanned: "Đang quét nguyên bản…",
    plateTitle: "Mona Lisa",
    plateMeta: "Leonardo da Vinci · khoảng 1503",
    marquee: ["Vẽ bằng tay", "Ký quỹ trên Solana", "Cọc 10%", "Bảo hiểm bùng kèo", "Chống bid phút chót", "Độc bản 1/1"],
    processEyebrow: "Một tác phẩm xứng đáng với giá của nó thế nào",
    process: [
      { t: "Vẽ", d: "Studio ghi lại từng nét thành time-lapse. Không phải ảnh chụp màn hình — mà là quá trình làm ra nó." },
      { t: "Chứng minh", d: "AI so với mọi tác phẩm đã mint. Mã băm time-lapse được neo on-chain qua chương trình SPL Memo." },
      { t: "Đấu giá", d: "Giá công khai, realtime. Mỗi lượt khóa 10% vào escrow PDA; người bị vượt được hoàn ngay. Bid phút chót sẽ gia hạn đồng hồ." },
      { t: "Thanh toán", d: "Người thắng trả 90% còn lại và NFT chuyển trong cùng một giao dịch. Bùng kèo thì 70% tiền cọc thuộc về nghệ sĩ." },
    ],
    galleryEyebrow: "Đang treo trên tường",
    galleryTitle: ["Tác phẩm", "đang bán"],
    viewAll: "Tất cả đấu giá",
    loading: "Đang đọc chương trình Solana…",
    emptyTitle: "Bức tường còn trống.",
    emptyText: "Hãy là người đầu tiên mint và treo tác phẩm ở đây.",
    manifestoEyebrow: "Luật chơi",
    manifesto:
      "Bùng kèo thì tiền cọc không biến mất vào một quỹ nào đó. Nó thuộc về người nghệ sĩ mà bạn vừa quay lưng.",
    ctaTitle: ["Hãy làm điều gì đó", "đáng được chứng minh."],
    ctaButton: "Mở Studio",
  },
} as const;

export default function ExplorePage() {
  const { locale } = useI18n();
  const c = copy[locale];
  const { connection } = useConnection();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [featured, setFeatured] = useState<Auction | null>(null);
  const [stats, setStats] = useState<MarketplaceStats>({
    totalListings: 0,
    activeAuctions: 0,
    highestBidSol: "0.00 SOL",
    totalVolumeSol: "0.00 SOL",
    floorPriceSol: "0.00 SOL",
    uniqueSellers: 0,
  });
  const [loading, setLoading] = useState(true);

  const heroRef = useRef<HTMLElement>(null);
  const processRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const manifestoRef = useRef<HTMLParagraphElement>(null);
  const metaRef = useInView<HTMLDivElement>();
  const introRef = useInView<HTMLDivElement>();
  const plateRef = useInView<HTMLAnchorElement>();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [listings, auctions, settled] = await Promise.all([
          fetchLiveListings(connection),
          fetchLiveAuctions(connection),
          fetchSettledVolumeSol(),
        ]);
        if (!isMounted) return;

        setArtworks(listings);
        if (auctions.length > 0) setFeatured(auctions[0]);

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
          totalVolumeSol: `${settled.volumeSol.toFixed(2)} SOL`,
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

  // ---------------- Motion ----------------
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const mm = gsap.matchMedia();

    // Hero: headline drifts up and fades as you leave; plate moves slower (depth)
    const heroCtx = gsap.context(() => {
      gsap.to("[data-hero-title]", {
        yPercent: -22,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, heroRef);

    // Process: pin the section and slide the track sideways (desktop only)
    mm.add("(min-width: 1024px)", () => {
      const track = trackRef.current;
      const section = processRef.current;
      if (!track || !section) return;
      const distance = () => track.scrollWidth - window.innerWidth;
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    });

    // Manifesto: words light up as you scroll
    const words = manifestoRef.current?.querySelectorAll<HTMLElement>("[data-word]");
    if (words && words.length) {
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: { trigger: manifestoRef.current, start: "top 78%", end: "bottom 45%", scrub: true },
        }
      );
    }

    // Layout shifts (data arriving) need a refresh so pin distances stay right
    const refresh = setTimeout(() => ScrollTrigger.refresh(), 800);

    return () => {
      clearTimeout(refresh);
      heroCtx.revert();
      mm.revert();
    };
  }, [locale]);

    const statValues = loading
    ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="w-[5ch]" />)
    : [`${stats.activeAuctions}`, `${stats.totalListings}`, stats.highestBidSol, stats.totalVolumeSol];

  return (
    <div id="top" className="relative flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />

      <main className="flex-1">
        {/* ============ HERO ============ */}
        <section ref={heroRef} className="relative flex min-h-[100svh] flex-col justify-between px-5 pb-10 pt-20 sm:px-8 lg:px-12">
          <div ref={metaRef} className="fade-up flex items-center justify-between font-mono-ui text-[10px] uppercase tracking-[0.18em] text-text-dim">
            <span className="flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              {c.meta}
            </span>
            <span className="hidden sm:block">N° 001 / 2026</span>
          </div>

          <div className="relative mx-auto grid w-full max-w-[1600px] flex-1 items-center py-6 lg:grid-cols-12">
            <div data-hero-title className="relative z-10 lg:col-span-9 lg:col-start-1">
              <LineReveal
                as="h1"
                lines={c.h1 as unknown as React.ReactNode[]}
                delay={0.25}
                stagger={0.12}
                className="mega text-[clamp(3.6rem,17.5vw,6.5rem)] md:text-[min(13.4vw,calc((100svh_-_395px)_/_2.9))]"
              />
            </div>

            {/* Specimen plate */}
            <div className="relative mt-10 w-full max-w-[420px] justify-self-end lg:absolute lg:right-0 lg:top-1/2 lg:-translate-y-1/2 lg:mt-0 lg:w-[min(27%,34vh)] lg:max-w-none">
              <Parallax speed={-0.08}>
                <Link href="/auctions" data-cursor className="block" ref={plateRef}>
                  <div style={{ "--d": "0.35s" } as React.CSSProperties} className="plate-wipe-soft">
                    <Frame3D src="/assets/mona-lisa-frame.png" alt={c.plateTitle} />
                  </div>
                  <div className="mt-5 flex items-baseline justify-between border-t border-line pt-2">
                    <span className="whitespace-nowrap font-display text-lg font-light tracking-[-0.02em]">{c.plateTitle}</span>
                    <span className="truncate pl-3 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text-dim-2">{c.plateMeta}</span>
                  </div>
                  <p className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-accent">● {c.scanned}</p>
                </Link>
              </Parallax>
            </div>
          </div>

          <div ref={introRef} style={{ "--d": "0.8s" } as React.CSSProperties} className="fade-up mx-auto grid w-full max-w-[1600px] gap-8 pt-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-5">
              <p className="max-w-lg text-[15px] leading-relaxed text-text-dim-2">{c.lede}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/auctions" className="btn !py-3">
                  {c.cta1} <span aria-hidden>→</span>
                </Link>
                <Link href="/create" className="btn btn-ghost !py-3">
                  {c.cta2}
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 sm:grid-cols-4 lg:col-span-7 lg:col-start-6">
              {c.stats.map((label, i) => (
                <div key={label}>
                  <dd className="font-display text-[clamp(1.5rem,2.6vw,2.4rem)] font-light leading-none tracking-[-0.03em]">{statValues[i]}</dd>
                  <dt className="eyebrow mt-2">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============ MARQUEE ============ */}
        <section className="border-y border-ink bg-bone py-5 text-ink" aria-hidden>
          <Marquee
            items={c.marquee.map((m) => (
              <span key={m} className="flex items-center gap-12 font-display text-[clamp(1.8rem,4vw,3.6rem)] font-light italic leading-none tracking-[-0.03em]">
                {m}
                <span className="font-mono-ui text-sm not-italic text-accent">✱</span>
              </span>
            ))}
          />
        </section>

        {/* ============ PROCESS (pinned horizontal) ============ */}
        <section ref={processRef} className="relative overflow-hidden border-b border-line lg:h-screen">
          <div className="px-5 pt-20 sm:px-8 lg:absolute lg:left-12 lg:top-12 lg:z-10 lg:px-0 lg:pt-0">
            <p className="eyebrow text-accent">{c.processEyebrow}</p>
          </div>
          <div ref={trackRef} className="flex flex-col lg:h-full lg:w-max lg:flex-row">
            {c.process.map((step, i) => (
              <article
                key={step.t}
                data-panel
                className="relative flex min-h-[80svh] w-full flex-col justify-end border-b border-line px-5 pb-14 pt-24 sm:px-8 lg:h-full lg:w-[78vw] lg:shrink-0 lg:border-b-0 lg:border-r lg:px-16 lg:pb-20"
              >
                <span
                 
                  className="pointer-events-none absolute right-6 top-16 select-none font-display text-[clamp(10rem,24vw,26rem)] font-light leading-none tracking-[-0.06em] text-transparent lg:right-10 lg:top-[10%]"
                  style={{ WebkitTextStroke: "1px rgba(236,231,218,0.3)" }}
                >
                  0{i + 1}
                </span>
                <div className="mb-10 lg:absolute lg:bottom-20 lg:right-16 lg:mb-0 lg:w-[34%]">
                  <ProcessVisual step={i as 0 | 1 | 2 | 3} />
                </div>
                <div className="relative max-w-2xl lg:max-w-[46%]">
                  <h3 className="mega text-[clamp(3.5rem,9vw,9rem)]">
                    {step.t}
                    <em>.</em>
                  </h3>
                  <p className="mt-6 max-w-lg text-lg leading-relaxed text-text-dim-2">
                    {step.d}
                  </p>
                  <div className="mt-8 h-px w-full bg-line">
                    <div className="h-px w-1/4 bg-accent" style={{ width: `${(i + 1) * 25}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ============ GALLERY ============ */}
        <section className="flex min-h-[100svh] flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-5 text-accent">{c.galleryEyebrow}</p>
                <LineReveal as="h2" inline lines={[...c.galleryTitle].map((l, i) => (i === 1 ? <em key={l}>{l}</em> : l))} className="mega text-[min(9vw,15vh)]" />
              </div>
              <Link href="/auctions" className="link-draw w-fit font-mono-ui text-[11px] uppercase tracking-[0.16em] text-text-dim-2 hover:text-text">
                {c.viewAll} →
              </Link>
            </div>

            <div className="mt-10">
              {loading ? (
                <Loading label={c.loading} />
              ) : artworks.length === 0 ? (
                <div className="border border-line px-6 py-14 text-center">
                  <p className="mega text-[clamp(2.5rem,7vw,6rem)]">{c.emptyTitle}</p>
                  <p className="mt-4 text-text-dim-2">{c.emptyText}</p>
                  <Link href="/create" className="btn mt-8">
                    {c.cta2}
                  </Link>
                </div>
              ) : (
                <div className="grid gap-x-10 gap-y-20 md:grid-cols-12">
                  {artworks.slice(0, 7).map((art, i) => {
                    const layout = [
                      "md:col-span-7",
                      "md:col-span-5 md:mt-40",
                      "md:col-span-4",
                      "md:col-span-4 md:mt-24",
                      "md:col-span-4 md:mt-8",
                      "md:col-span-6",
                      "md:col-span-6 md:mt-28",
                    ][i];
                    const speed = [0.04, -0.06, 0.03, -0.05, 0.05, -0.03, 0.06][i];
                    return (
                      <div key={art.id} className={layout}>
                        <Parallax speed={speed}>
                          <FadeUp>
                            <ArtworkCard artwork={{ ...art, size: i === 0 || i === 5 ? "large" : "small" }} index={i} />
                          </FadeUp>
                        </Parallax>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============ MANIFESTO (inverted) ============ */}
        <section className="relative flex min-h-[100svh] items-center bg-bone px-5 py-24 text-ink sm:px-8 lg:px-12">
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">
            <p className="eyebrow mb-10 !text-ink/55">{c.manifestoEyebrow}</p>
            <p ref={manifestoRef} className="break-words font-display text-[clamp(1.8rem,min(5.2vw,9.5vh),5.6rem)] font-light leading-[1.06] tracking-[-0.035em]">
              {c.manifesto.split(" ").map((w, i) => (
                <span key={i} data-word className="inline-block pr-[0.22em]">
                  {w}
                </span>
              ))}
            </p>
          </div>
        </section>

        {/* ============ FINAL CTA ============ */}
        <section className="flex min-h-[100svh] items-center px-5 py-24 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[1600px]">
            <LineReveal
              as="h2"
              lines={[c.ctaTitle[0], <em key="x">{c.ctaTitle[1]}</em>]}
              className="mega text-[min(11vw,19vh)]"
            />
            <Link href="/create" className="group mt-14 inline-flex items-center gap-6" data-cursor>
              <span className="flex size-20 items-center justify-center rounded-full bg-accent text-3xl text-ink transition-transform duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[-45deg] group-hover:scale-110">
                →
              </span>
              <span className="link-draw font-mono-ui text-sm uppercase tracking-[0.18em]">{c.ctaButton}</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
