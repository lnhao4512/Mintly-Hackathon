import Link from "next/link";
import { ArrowUpIcon } from "@/components/ui/Icons";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const columns = [
  { links: ["footer.provenance", "footer.manifesto"] },
  { links: ["footer.support", "footer.privacy", "footer.terms"] },
];

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[rgba(68,71,72,0.2)] bg-[#0a0d10] px-6 pb-20 pt-20 md:px-16">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-5 md:max-w-[320px]">
          <p className="font-display text-[32px] leading-10 text-text">MINTLY</p>
          <p className="eyebrow leading-4 text-text-dim">
            © 2024 MINTLY.
            <br />
            {t("footer.tagline")}
          </p>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-4">
              {col.links.map((link) => (
                <Link
                  key={link}
                  href="#"
                  className="eyebrow transition-colors duration-300 hover:text-text"
                >
                  {t(link as TranslationKey)}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-start justify-start md:items-end md:justify-end">
          <a
            href="#top"
            aria-label={t("footer.backToTop")}
            className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-text transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08]"
          >
            <ArrowUpIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}
