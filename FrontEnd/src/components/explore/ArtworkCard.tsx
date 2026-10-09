import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export type Artwork = {
  id: string;
  title: string;
  artist: string;
  price: string;
  priceLabel?: string;
  image: string;
  size?: "large" | "small";
  rarity?: "trending" | "collector" | "rare";
  href?: string;
  nftMint?: string;
};

/** Museum-label card: framed plate on top, specimen label underneath. */
export function ArtworkCard({ artwork, index }: { artwork: Artwork; index?: number }) {
  const { t } = useI18n();
  const isLarge = artwork.size === "large";
  const lot = typeof index === "number" ? String(index + 1).padStart(2, "0") : null;
  const direct = artwork.priceLabel === "Direct Sale";

  return (
    <Link href={artwork.href || `/listings/${artwork.id}`} className="group block" data-cursor="img">
      <div className={`relative overflow-hidden bg-bg-elevated ${isLarge ? "aspect-[4/5]" : "aspect-[5/4]"}`}>
        <Image
          src={artwork.image}
          alt={artwork.title}
          fill
          sizes={isLarge ? "(max-width:768px) 100vw, 45vw" : "(max-width:768px) 100vw, 30vw"}
          className="object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent opacity-70 transition-opacity duration-700 group-hover:opacity-30" />
        <i className="reg left-3 top-3" />
        <i className="reg right-3 top-3" />
        <i className="reg bottom-3 left-3" />
        <i className="reg bottom-3 right-3" />
        <span className="absolute left-4 top-4 bg-ink/80 px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-text backdrop-blur-sm">
          {artwork.priceLabel ?? "Live"}
        </span>
        {artwork.rarity && (
          <span className="absolute right-4 top-4 bg-accent px-2 py-1 font-mono-ui text-[9px] uppercase tracking-[0.16em] text-ink">
            {artwork.rarity}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 border-t border-line pt-3">
        <span className="font-mono-ui text-[10px] tracking-[0.14em] text-text-dim">{lot ? `№ ${lot}` : "№"}</span>
        <h3 className="truncate font-display text-[clamp(1.3rem,2vw,1.9rem)] font-light leading-tight tracking-[-0.03em] transition-colors duration-500 group-hover:text-accent">
          {artwork.title}
        </h3>
        <span className="font-mono-ui text-sm text-text">{artwork.price}</span>
        <span />
        <span className="eyebrow truncate">
          {t("card.by")} {artwork.artist}
        </span>
        <span className="eyebrow text-right">{direct ? t("card.buyNow") : t("card.bid")}</span>
      </div>
    </Link>
  );
}
