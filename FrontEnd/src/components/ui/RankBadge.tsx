"use client";

import { useEffect, useState } from "react";
import { LineIcon } from "@/components/ui/LineIcon";
import { loadTrades, rankForTrades, type RankInfo } from "@/lib/rank";
import { useI18n } from "@/lib/i18n";

/**
 * Membership rank of a wallet (Bronze to Diamond) from its completed trades, as seller or buyer.
 * Renders nothing until the number is known, so no placeholder rank is ever shown.
 */
export function RankBadge({ wallet, className = "" }: { wallet?: string | null; className?: string }) {
  const { L } = useI18n();
  const [info, setInfo] = useState<RankInfo | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    loadTrades(wallet).then((n) => {
      if (alive && n >= 0) setInfo(rankForTrades(n));
    });
    return () => {
      alive = false;
    };
  }, [wallet]);

  if (!wallet || !info) return null;
  const { tier, next, remaining, trades } = info;
  const title = next
    ? L(
        `${trades} giao dịch hoàn tất (mua + bán). Còn ${remaining} giao dịch nữa để lên ${next.vi}.`,
        `${trades} completed trades (buy + sell). ${remaining} more to reach ${next.en}.`
      )
    : L(`${trades} giao dịch hoàn tất (mua + bán). Hạng cao nhất.`, `${trades} completed trades (buy + sell). Top rank.`);

  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[0.08em] ${className}`}
      style={{ color: tier.color, borderColor: `color-mix(in srgb, ${tier.color} 45%, transparent)`, background: `color-mix(in srgb, ${tier.color} 10%, transparent)` }}
    >
      <LineIcon name="gem" className="size-3" />
      {L(tier.vi, tier.en)}
    </span>
  );
}
