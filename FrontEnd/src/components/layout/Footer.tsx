"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { LineReveal } from "@/components/motion/Reveal";

const cols: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Market",
    links: [
      { label: "Auctions", href: "/auctions" },
      { label: "Fixed price", href: "/market" },
      { label: "Live drawing", href: "/live" },
    ],
  },
  {
    title: "Proof",
    links: [
      { label: "Originality check", href: "/originality" },
      { label: "Verify a mint", href: "/verify" },
      { label: "Studio", href: "/create" },
    ],
  },
  {
    title: "Fine print",
    links: [
      { label: "Legal & risk", href: "/legal" },
      { label: "Vault", href: "/portfolio" },
    ],
  },
];

export function Footer() {
  const { t, locale } = useI18n();
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-line px-5 pb-16 pt-16 sm:px-8 lg:px-12">
      <div className="mx-auto w-full max-w-[1600px]">
        <div className="grid gap-12 md:grid-cols-[1.2fr_2fr]">
          <p className="max-w-sm font-display text-2xl font-light leading-snug tracking-[-0.02em] text-text-dim-2">
            {t("footer.tagline")} <span className="text-text-dim">{locale === "vi" ? "Vẽ bằng tay. Chứng minh nguyên bản. Ký quỹ trên Solana." : "Drawn by hand. Proven original. Escrowed on Solana."}</span>
          </p>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((c) => (
              <div key={c.title} className="flex flex-col gap-3">
                <p className="eyebrow">{c.title}</p>
                {c.links.map((l) => (
                  <Link key={l.href} href={l.href} className="link-draw w-fit text-sm text-text-dim-2 hover:text-text">
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <LineReveal
          as="div"
          lines={["MINTLY"]}
          className="mega mt-16 select-none text-[clamp(5rem,26vw,28rem)] !leading-[0.78] text-text"
        />

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-text-dim sm:flex-row sm:justify-between">
          <span>© 2026 Mintly — Mini Hackathon Solana</span>
          <span>Devnet demo · not financial advice</span>
          <a href="#top" className="link-draw w-fit text-text-dim-2 hover:text-text">
            {t("footer.backToTop")} ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
