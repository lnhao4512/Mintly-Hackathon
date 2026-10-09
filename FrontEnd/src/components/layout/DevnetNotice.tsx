"use client";

import { useI18n } from "@/lib/i18n";
import { NETWORK } from "@/lib/config";

/** Thin banner so devnet numbers are never mistaken for real traction. */
export function DevnetNotice() {
  const { t } = useI18n();
  if (NETWORK === "mainnet-beta") return null;
  return (
    <div className="relative z-[60] w-full bg-[#ffb86b]/15 px-4 py-1.5 text-center text-[11px] text-[#ffcf99]">
      {t("notice.devnet")}
    </div>
  );
}
