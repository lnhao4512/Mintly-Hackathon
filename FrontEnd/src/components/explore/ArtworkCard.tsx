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

export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const { t } = useI18n();
  const isLarge = artwork.size === "large";
  const rarityTone =
    artwork.rarity === "rare"
      ? "border-[#f5d27b]/30 bg-[#f5d27b]/10 text-[#f5d27b]"
      : artwork.rarity === "collector"
        ? "border-[#c7b7ff]/30 bg-[#c7b7ff]/10 text-[#d9ceff]"
        : "border-[#8ef7c0]/30 bg-[#8ef7c0]/10 text-[#8ef7c0]";

  return (
    <Link href={artwork.href || `/listings/${artwork.id}`} className="group block">
      <div
        className={`rainbow-border relative w-full overflow-hidden rounded-[30px] bg-[#111315] transition-all duration-300 group-hover:-translate-y-1 ${
          isLarge ? "aspect-[16/13]" : "aspect-[4/3]"
        }`}
      >
        <Image
          src={artwork.image}
          alt={artwork.title}
          fill
          sizes={isLarge ? "(max-width:768px) 100vw, 55vw" : "(max-width:768px) 100vw, 40vw"}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090b0d]/90 via-[#090b0d]/25 to-transparent" />

        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-3">
          <span className="rounded-full border border-[#d9d0ff]/20 bg-[#12131a]/70 px-3 py-1 backdrop-blur-sm">
            <span className="eyebrow text-accent-strong">{artwork.priceLabel ?? "Live"}</span>
          </span>
          {artwork.rarity && (
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${rarityTone}`}>
              {artwork.rarity}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <div>
            <div className="font-display text-xl leading-none text-text sm:text-2xl">{artwork.title}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-text-dim">{t("card.by")} {artwork.artist}</div>
          </div>
          <div className="text-right">
            <div className="font-sans text-lg font-semibold text-text">{artwork.price}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-dim">
              {artwork.priceLabel === "Direct Sale" ? t("card.buyNow") : t("card.bid")}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
