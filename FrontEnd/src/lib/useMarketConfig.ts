"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { getMarketplaceProgram } from "@/utils/anchor";
import { getConfigPda, MARKETPLACE_FEE_BPS } from "@/lib/config";

export interface MarketConfigView {
  loaded: boolean;
  feeBps: number;
  depositBps: number;
  paused: boolean;
  /** "2.5" — trailing zeros trimmed */
  feePct: string;
}

const pct = (bps: number) => String(Number((bps / 100).toFixed(2)));

let cached: MarketConfigView | null = null;

/** Live marketplace settings read from the on-chain MarketplaceConfig, so the UI never states a stale fee. */
export function useMarketConfig(): MarketConfigView {
  const { connection } = useConnection();
  const [view, setView] = useState<MarketConfigView>(
    cached ?? { loaded: false, feeBps: MARKETPLACE_FEE_BPS, depositBps: 1000, paused: false, feePct: pct(MARKETPLACE_FEE_BPS) }
  );

  useEffect(() => {
    if (cached) return;
    let alive = true;
    (async () => {
      try {
        const program = getMarketplaceProgram(connection) as any;
        const cfg = await program.account.marketplaceConfig.fetch(getConfigPda()[0]);
        const next: MarketConfigView = {
          loaded: true,
          feeBps: Number(cfg.feeBps),
          depositBps: Number(cfg.depositBps),
          paused: !!cfg.paused,
          feePct: pct(Number(cfg.feeBps)),
        };
        cached = next;
        if (alive) setView(next);
      } catch {
        /* keep the defaults; the fee is re-read on the next mount */
      }
    })();
    return () => {
      alive = false;
    };
  }, [connection]);

  return view;
}
