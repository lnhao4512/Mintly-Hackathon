"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { fetchReputation, type Reputation } from "@/lib/reputation";

const STYLE: Record<Reputation["tier"], { label: string; cls: string }> = {
  new: { label: "Người mới", cls: "border-white/15 text-text-dim" },
  trusted: { label: "Uy tín", cls: "border-green-500/30 bg-green-500/10 text-green-300" },
  risky: { label: "Từng bùng kèo", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
};

/** Reputation of a bidder wallet (paid vs defaulted auctions). */
export function ReputationBadge({ wallet }: { wallet: string }) {
  const { connection } = useConnection();
  const [rep, setRep] = useState<Reputation | null>(null);

  useEffect(() => {
    let active = true;
    fetchReputation(connection, wallet).then((r) => active && setRep(r));
    return () => {
      active = false;
    };
  }, [connection, wallet]);

  if (!rep) return null;
  const s = STYLE[rep.tier];
  return (
    <span
      title={`Đã thanh toán đủ: ${rep.paid} · Bùng kèo: ${rep.defaulted}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}
    >
      {s.label} · {rep.score}
    </span>
  );
}
