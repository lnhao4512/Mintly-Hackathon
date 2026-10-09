"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { gsap } from "@/lib/gsap";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const primary = [
  { key: "nav.market", href: "/market" },
  { key: "nav.auctions", href: "/auctions" },
  { key: "nav.create", href: "/create" },
  { key: "nav.live", href: "/live" },
];

const all = [
  ...primary,
  { key: "nav.originality", href: "/originality" },
  { key: "nav.portfolio", href: "/portfolio" },
];

export function Navbar() {
  const pathname = usePathname();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { locale, toggleLocale, t } = useI18n();
  const [solBalance, setSolBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publicKey || !connection) return;
    let isMounted = true;
    connection.getBalance(publicKey).then((b) => isMounted && setSolBalance(b / 1e9)).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [publicKey, connection]);

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > last && y > 240 && !open);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  // Full-screen menu: clip-path wipe + staggered links
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const items = el.querySelectorAll<HTMLElement>("[data-menu-item]");
    if (open) {
      document.documentElement.classList.add("lenis-stopped");
      gsap.set(el, { display: "flex" });
      gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "expo.inOut" });
      gsap.fromTo(items, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.07, delay: 0.35 });
    } else {
      document.documentElement.classList.remove("lenis-stopped");
      gsap.to(el, {
        clipPath: "inset(0 0 100% 0)",
        duration: 0.7,
        ease: "expo.inOut",
        onComplete: () => {
          gsap.set(el, { display: "none" });
        },
      });
    }
    return () => {
      document.documentElement.classList.remove("lenis-stopped");
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname.startsWith(href);
  const short = publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "";

  const wallet = connected && publicKey ? (
    <button
      type="button"
      onClick={() => void disconnect()}
      title={t("nav.disconnect")}
      className="group flex items-center gap-3 border border-line px-3.5 py-2 text-left transition-colors hover:border-accent"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      <span className="font-mono-ui text-[10px] uppercase leading-tight tracking-[0.12em] text-text">
        {short}
        <span className="block text-text-dim">{solBalance.toFixed(3)} SOL</span>
      </span>
    </button>
  ) : (
    <button type="button" onClick={() => setVisible(true)} className="btn !py-2.5">
      {t("nav.connect")}
    </button>
  );

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[transform,background] duration-500 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        } ${scrolled ? "bg-ink/80 backdrop-blur-md" : "bg-transparent"}`}
        style={{ transitionTimingFunction: "var(--ease-out-expo)" }}
      >
        <div className="mx-auto flex h-[68px] w-full max-w-[1600px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="group flex items-center gap-3" data-cursor>
            <span className="relative block size-7 overflow-hidden">
              <Image src="/logo.png" alt="MINTLY" fill className="object-cover grayscale transition-all duration-500 group-hover:grayscale-0" priority />
            </span>
            <span className="font-display text-[26px] font-medium leading-none tracking-[-0.04em]">
              Mintly<sup className="ml-0.5 align-super font-mono-ui text-[8px] text-accent">®</sup>
            </span>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex">
            {primary.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={`link-draw font-mono-ui text-[11px] uppercase tracking-[0.16em] transition-colors ${
                  isActive(link.href) ? "text-accent" : "text-text-dim-2 hover:text-text"
                }`}
              >
                <span className="mr-1.5 text-text-dim">0{i + 1}</span>
                {t(link.key as TranslationKey)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t("nav.language")}
              className="hidden font-mono-ui text-[11px] uppercase tracking-[0.16em] text-text-dim transition-colors hover:text-text sm:block"
            >
              {locale === "en" ? "VI" : "EN"}
            </button>
            <div className="hidden sm:block">{wallet}</div>
            <button
              type="button"
              aria-label={t("nav.menu")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="relative z-[70] flex h-10 items-center gap-3 border border-line px-4 font-mono-ui text-[11px] uppercase tracking-[0.16em] transition-colors hover:border-accent"
            >
              {open ? "Close" : "Menu"}
              <span className="relative block h-2 w-5">
                <span className={`absolute left-0 h-px w-full bg-current transition-all duration-500 ${open ? "top-1 rotate-45" : "top-0"}`} />
                <span className={`absolute left-0 h-px w-full bg-current transition-all duration-500 ${open ? "top-1 -rotate-45" : "top-2"}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Full-screen menu */}
      <div ref={overlayRef} className="fixed inset-0 z-[65] hidden flex-col justify-between bg-bone px-5 pb-12 pt-28 text-ink sm:px-8 lg:px-12" style={{ clipPath: "inset(0 0 100% 0)" }}>
        <nav className="flex flex-col">
          {all.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="group relative block overflow-hidden border-b border-ink/15"
            >
              <span data-menu-item className="flex items-baseline gap-5 py-2 sm:gap-8">
                <span className="font-mono-ui text-[11px] tracking-[0.16em] text-ink/50">0{i + 1}</span>
                <span className="font-display text-[clamp(2.4rem,8vw,6.5rem)] font-light leading-[1] tracking-[-0.04em] transition-all duration-500 group-hover:translate-x-4 group-hover:italic group-hover:text-accent">
                  {t(link.key as TranslationKey)}
                </span>
              </span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-center gap-4 sm:hidden">
            {wallet}
          </div>
          <button onClick={toggleLocale} className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-ink/60 hover:text-ink">
            {locale === "en" ? "Tiếng Việt" : "English"}
          </button>
          <p className="max-w-xs font-mono-ui text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink/50">
            Solana Devnet · Program Cp7n…3XdRq
          </p>
        </div>
      </div>
    </>
  );
}
