"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ArtworkCard, type Artwork } from "@/components/explore/ArtworkCard";
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
    metaLine: "N° 001 / 2026",
    kicker: "Art that can",
    big: ["PROVE", "ITSELF"],
    sub: "Drawn by hand · proven original · escrowed on-chain",
    plateTitle: "Mona Lisa",
    plateMeta: "Leonardo da Vinci · c. 1503",
    seal: "PROOF OF HAND · 1/1 · SOLANA · ",
    notes: [
      { k: "Originality scan", v: "pHash · dHash · CLIP" },
      { k: "Proof of creation", v: "Time-lapse · SPL Memo" },
      { k: "Escrow deposit", v: "10% locked · 70/30 insured" },
    ],
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
    metaLine: "N° 001 / 2026",
    kicker: "Nghệ thuật biết tự",
    big: ["CHỨNG", "MINH"],
    sub: "Vẽ bằng tay · chứng minh nguyên bản · ký quỹ on-chain",
    plateTitle: "Mona Lisa",
    plateMeta: "Leonardo da Vinci · khoảng 1503",
    seal: "VẼ BẰNG TAY · 1/1 · SOLANA · ",
    notes: [
      { k: "Quét nguyên bản", v: "pHash · dHash · CLIP" },
      { k: "Bằng chứng sáng tác", v: "Time-lapse · SPL Memo" },
      { k: "Cọc ký quỹ", v: "Khóa 10% · bảo hiểm 70/30" },
    ],
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
  const annotRef = useInView<HTMLDivElement>();

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

    // Hero: the gallery photo drifts slower than the page (depth), the frame lifts away
    const heroCtx = gsap.context(() => {
      gsap.to("[data-hero-bg]", {
        yPercent: 12,
        scale: 1.06,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to("[data-hero-frame]", {
        yPercent: -10,
        ease: "none",
        scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: true },
      });
    }, heroRef);

    // Process: pin the section and slide the track sideways (desktop only);
    // every panel's landscape photo drifts sideways inside its frame (parallax)
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
      gsap.utils.toArray<HTMLElement>("[data-panel]").forEach((panel) => {
        const img = panel.querySelector<HTMLElement>("[data-step-img]");
        if (!img) return;
        gsap.fromTo(
          img,
          { xPercent: -9 },
          {
            xPercent: 9,
            ease: "none",
            scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left right", end: "right left", scrub: true },
          }
        );
      });
    });

    // Manifesto: words light up in reading order as you scroll.
    // One ScrollTrigger writes every word's opacity from the same progress value, so there are no
    // stacked tweens that could disagree with each other (the old bug).
    const words = manifestoRef.current ? Array.from(manifestoRef.current.querySelectorAll<HTMLElement>("[data-word]")) : [];
    const manifestoST = words.length
      ? ScrollTrigger.create({
          trigger: manifestoRef.current,
          start: "top 80%",
          end: "bottom 40%",
          onUpdate: (self) => {
            const lit = self.progress * (words.length + 3);
            words.forEach((w, i) => {
              w.style.opacity = String(0.14 + 0.86 * Math.min(1, Math.max(0, lit - i)));
            });
          },
          onRefresh: (self) => {
            const lit = self.progress * (words.length + 3);
            words.forEach((w, i) => {
              w.style.opacity = String(0.14 + 0.86 * Math.min(1, Math.max(0, lit - i)));
            });
          },
        })
      : null;

    // Layout shifts (data arriving) need a refresh so pin distances stay right
    const refresh = setTimeout(() => ScrollTrigger.refresh(), 800);

    return () => {
      clearTimeout(refresh);
      manifestoST?.kill();
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
        <section ref={heroRef} className="relative h-[100svh] min-h-[560px] overflow-hidden bg-ink">
          {/* the gallery */}
          <div data-hero-bg className="absolute inset-x-0 will-change-transform" style={{ top: "-8%", bottom: "-8%" }}>
            <Image
              src="/museum.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ filter: "brightness(0.86) saturate(0.85) sepia(0.28) contrast(1.05)" }}
            />
          </div>
          {/* out-of-focus visitors at the edges, warm light, fade into the page */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[26%] backdrop-blur-md"
            style={{ WebkitMaskImage: "linear-gradient(90deg,#000 25%,transparent)", maskImage: "linear-gradient(90deg,#000 25%,transparent)" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-[26%] backdrop-blur-md"
            style={{ WebkitMaskImage: "linear-gradient(270deg,#000 25%,transparent)", maskImage: "linear-gradient(270deg,#000 25%,transparent)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_36%,rgba(255,196,120,0.12),rgba(10,10,9,0.42)_75%)]" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-ink/85 to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-ink via-ink/70 to-transparent" />

          {/* the framed work, hung on the wall */}
          <Link
            href="/auctions"
            data-cursor="img"
            data-hero-frame
            ref={plateRef}
            className="absolute left-1/2 top-[11%] z-10 block -translate-x-1/2"
            style={{ width: "min(46vh, 62vw)" }}
          >
            <div style={{ "--d": "0.35s" } as React.CSSProperties} className="plate-wipe-soft">
              <Frame3D src="/assets/mona-lisa-frame.png" alt={c.plateTitle} />
            </div>
          </Link>

          {/* top-left: edition line */}
          <div ref={metaRef} className="fade-up absolute left-5 top-24 z-10 max-w-[230px] sm:left-8 lg:left-12">
            <p className="eyebrow !text-text">{c.metaLine}</p>
            <span className="my-3 block h-px w-10 bg-text/70" />
            <p className="text-[11px] leading-snug text-text-dim-2">{c.meta}</p>
          </div>

          {/* left: what the platform does, as small captions */}
          <ul className="absolute left-5 top-1/2 z-10 hidden -translate-y-[40%] flex-col gap-6 sm:left-8 lg:left-12 lg:flex">
            {c.notes.map((n, i) => (
              <li key={n.k} className="max-w-[170px]">
                <span className="mb-2 block h-px w-8 bg-text/60" />
                <p className="eyebrow !text-text-dim-2">{`0${i + 1} · ${n.k}`}</p>
                <p className="mt-1 text-[11px] leading-snug text-text-dim">{n.v}</p>
              </li>
            ))}
          </ul>

          {/* top-right: live numbers, like camera counters */}
          <dl className="absolute right-5 top-24 z-10 flex flex-col items-end gap-1.5 sm:right-8 lg:right-12">
            {c.stats.map((label, i) => (
              <div key={label} className="flex items-center gap-3 font-mono-ui text-[11px] uppercase tracking-[0.14em] text-text-dim-2">
                <span className="text-text-dim">{i + 1} ◄</span>
                <dt>{label}</dt>
                <dd className="min-w-[4.5ch] text-right text-text">{statValues[i]}</dd>
              </div>
            ))}
          </dl>

          {/* right: lede, small and quiet */}
          <p className="absolute right-5 top-1/2 z-10 hidden max-w-[230px] -translate-y-[10%] text-right font-display text-[13px] font-light italic leading-relaxed text-text-dim-2 sm:right-8 lg:right-12 lg:block">
            {c.lede}
          </p>

          {/* bottom: headline */}
          <div ref={introRef} className="fade-up absolute inset-x-0 bottom-[calc(30px+1.5rem)] z-10 flex flex-col items-center px-5 text-center" style={{ "--d": "0.5s" } as React.CSSProperties}>
            <LineReveal
              as="h1"
              delay={0.25}
              stagger={0.12}
              className="flex flex-col items-center"
              lines={[
                <span key="k" className="flex items-center gap-4 font-display text-[clamp(0.95rem,1.7vw,1.5rem)] font-light italic tracking-[-0.01em] text-text-dim-2">
                  <span className="hidden h-px w-14 bg-text/50 sm:block" />
                  {c.kicker}
                  <span className="hidden h-px w-14 bg-text/50 sm:block" />
                </span>,
                <span key="b" className="mega block text-[min(8.2vw,13vh)] !leading-[0.95]">
                  {c.big[0]} <em>{c.big[1]}</em>
                </span>,
              ]}
            />
            <p className="mt-2 font-mono-ui text-[10px] uppercase tracking-[0.2em] text-text-dim">{c.sub}</p>
          </div>

          {/* bottom corners */}
          <div className="absolute bottom-[calc(30px+1.5rem)] left-5 z-10 hidden gap-3 sm:left-8 lg:left-12 lg:flex">
            <Link href="/auctions" className="btn !py-3">
              {c.cta1} <span aria-hidden>→</span>
            </Link>
            <Link href="/create" className="btn btn-ghost !py-3">
              {c.cta2}
            </Link>
          </div>
          <p className="absolute bottom-[calc(30px+1.5rem)] right-5 z-10 hidden text-right font-mono-ui text-[10px] uppercase leading-relaxed tracking-[0.14em] text-text-dim sm:right-8 lg:right-12 lg:block">
            {c.plateTitle} — {c.plateMeta}
            <span className="block text-accent">● {c.scanned}</span>
          </p>
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
                className="relative flex min-h-[90svh] w-full flex-col justify-end overflow-hidden border-b border-line px-5 pb-14 pt-24 sm:px-8 lg:h-full lg:w-screen lg:shrink-0 lg:flex-row lg:items-end lg:justify-start lg:gap-12 lg:border-b-0 lg:border-r lg:px-16 lg:pb-20"
              >
                {/* photo as the background; it drifts sideways inside the panel while you scroll */}
                <div data-step-img className="absolute inset-y-0 -left-[10%] w-[120%] will-change-transform">
                  <Image src={`/museum${i + 3}.jpg`} alt="" fill sizes="100vw" className="object-cover" style={{ filter: "saturate(0.85) sepia(0.12)" }} />
                </div>
                {/* black overlay so the type always reads: even tint + a heavier left side + soft top/bottom */}
                <div aria-hidden className="absolute inset-0 bg-ink/55" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/45 to-ink/10" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/60" />

                <span
                  className="pointer-events-none absolute right-5 top-16 select-none font-display text-[clamp(8rem,22vw,24rem)] font-light leading-none tracking-[-0.06em] text-transparent lg:relative lg:right-auto lg:top-auto lg:shrink-0 lg:text-[clamp(8rem,18vw,20rem)] lg:leading-[0.78]"
                  style={{ WebkitTextStroke: "1.5px rgba(236,231,218,0.85)" }}
                >
                  0{i + 1}
                </span>
                <div className="relative max-w-2xl lg:max-w-[40%] lg:pl-4">
                  <p className="eyebrow mb-4 !text-text-dim-2">{`0${i + 1} / 04`}</p>
                  <h3 className="mega text-[clamp(3.5rem,9vw,9rem)]">
                    {step.t}
                    <em>.</em>
                  </h3>
                  <p className="mt-6 max-w-lg text-lg leading-relaxed text-text">
                    {step.d}
                  </p>
                  <div className="mt-8 h-px w-full bg-text/25">
                    <div className="h-px bg-accent" style={{ width: `${(i + 1) * 25}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ============ GALLERY ============ */}
        <section className="flex min-h-[100svh] flex-col justify-center px-5 py-16 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-5 text-accent">{c.galleryEyebrow}</p>
                <LineReveal as="h2" inline lines={[...c.galleryTitle].map((l, i) => (i === 1 ? <em key={l}>{l}</em> : l))} className="mega whitespace-nowrap text-[min(9vw,15vh)]" />
              </div>
              <Link href="/auctions" className="link-draw w-fit shrink-0 self-start font-mono-ui sm:self-end text-[11px] uppercase tracking-[0.16em] text-text-dim-2 hover:text-text">
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
