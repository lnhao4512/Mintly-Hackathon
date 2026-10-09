"use client";

import { useI18n } from "@/lib/i18n";
import { NETWORK } from "@/lib/config";
import { Marquee } from "@/components/motion/Reveal";

/** Bottom ticker so devnet figures are never mistaken for real traction. */
export function DevnetNotice() {
  const { t } = useI18n();
  if (NETWORK === "mainnet-beta") return null;
  const item = (
    <span className="flex items-center gap-4 font-mono-ui text-[10px] uppercase tracking-[0.18em]">
      <span className="size-1.5 rounded-full bg-accent" />
      {t("notice.devnet")}
    </span>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-ink py-2 text-text-dim">
      <Marquee items={[item, item]} />
    </div>
  );
}
