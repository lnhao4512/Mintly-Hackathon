"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SearchIcon, CollectionIcon } from "@/components/ui/Icons";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const links = [
  { key: "nav.explore", href: "/" },
  { key: "nav.create", href: "/create" },
  { key: "nav.auctions", href: "/auctions" },
  { key: "nav.portfolio", href: "/portfolio" },
];

export function Navbar() {
  const pathname = usePathname();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const { locale, toggleLocale, t } = useI18n();
  const [solBalance, setSolBalance] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!publicKey || !connection) return;

    let isMounted = true;

    connection.getBalance(publicKey).then((balance) => {
      if (isMounted) {
        setSolBalance(balance / 1e9);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [publicKey, connection]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const truncatedAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 5)}...${publicKey.toBase58().slice(-3)}`
    : "";

  const walletDisplay = connected && publicKey ? (
    <button
      type="button"
      onClick={() => void disconnect()}
      className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left transition-all duration-300 hover:border-accent/50 hover:bg-[rgba(184,165,255,0.08)]"
    >
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-green-400" />
      </span>
      <span className="flex flex-col">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-strong">{truncatedAddress}</span>
        <span className="text-[9px] text-text-dim">{solBalance.toFixed(4)} SOL</span>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setVisible(true)}
      className="rounded-full bg-accent px-5 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-all duration-300 hover:bg-accent-strong hover:shadow-[0_14px_44px_-14px_rgba(184,165,255,0.8)]"
    >
      {t("nav.connect")}
    </button>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-3 sm:px-5">
      <nav className="pointer-events-auto w-full max-w-[1240px] rounded-full border border-white/10 bg-[rgba(12,14,18,0.78)] px-4 shadow-[0_18px_50px_-25px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between sm:h-20">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 transition-transform duration-200 hover:scale-[1.02]"
            >
              <div className="relative size-8 sm:size-9 overflow-hidden rounded-xl border border-white/15 bg-[#1f2b23] shadow-inner transition-transform group-hover:rotate-3">
                <Image
                  src="/logo.png"
                  alt="MINTLY Logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <span className="font-display text-[22px] leading-none tracking-[-1px] text-text sm:text-[26px] lg:text-[28px]">
                MINTLY
              </span>
            </Link>
            <span className="hidden rounded-full border border-white/10 bg-white/[0.02] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.22em] text-text-dim md:inline-flex">
              {t("nav.fieldStudio")}
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`eyebrow border-b pb-[5px] transition-colors duration-300 ${
                  isActive(link.href)
                    ? "border-text-dim-2 text-text-dim-2"
                    : "border-transparent text-text-dim hover:text-text"
                }`}
              >
                {t(link.key as TranslationKey)}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              aria-label={t("nav.search")}
              className="hidden rounded-full border border-white/10 bg-white/[0.02] p-2.5 text-text-dim transition-colors duration-300 hover:border-white/15 hover:text-text sm:block"
            >
              <SearchIcon />
            </button>
            <Link
              href="/portfolio"
              aria-label={t("nav.collections")}
              className="hidden rounded-full border border-white/10 bg-white/[0.02] p-2.5 text-text-dim transition-colors duration-300 hover:border-white/15 hover:text-text sm:block"
            >
              <CollectionIcon />
            </Link>
            <div className="hidden sm:block">{walletDisplay}</div>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={t("nav.language")}
              className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] font-bold tracking-[0.12em] text-text-dim transition-colors hover:border-accent/40 hover:text-text sm:block"
            >
              {locale === "en" ? "VI" : "EN"}
            </button>
            <button
              type="button"
              aria-label={t("nav.menu")}
              onClick={() => setMobileOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-text md:hidden"
            >
              <span className="flex flex-col gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-4 rounded-full bg-current" />
                <span className="h-0.5 w-4 rounded-full bg-current" />
              </span>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 pb-4 pt-3 md:hidden">
            <div className="flex flex-col gap-3">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-2xl px-3 py-2 text-sm transition-colors ${
                    isActive(link.href)
                      ? "bg-white/8 text-text"
                      : "text-text-dim hover:bg-white/5 hover:text-text"
                  }`}
                >
                  {t(link.key as TranslationKey)}
                </Link>
              ))}
              <button
                type="button"
                onClick={toggleLocale}
                className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm text-text-dim hover:bg-white/5 hover:text-text"
              >
                <span>{t("nav.language")}</span>
                <span className="font-mono text-[10px] font-bold tracking-[0.12em]">{locale === "en" ? "VI" : "EN"}</span>
              </button>
              <div className="pt-2">{walletDisplay}</div>
            </div>
          </div>
        )}
      </nav>
    </div>
  );
}

