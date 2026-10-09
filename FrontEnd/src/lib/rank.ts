export type RankId = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export interface RankTier {
  id: RankId;
  vi: string;
  en: string;
  /** completed trades (as seller or buyer) needed to reach this tier */
  min: number;
  color: string;
}

/** Membership-style ranks: the more completed trades, the higher the tier. */
export const RANKS: RankTier[] = [
  { id: "bronze", vi: "Đồng", en: "Bronze", min: 0, color: "#cd7f32" },
  { id: "silver", vi: "Bạc", en: "Silver", min: 3, color: "#c3cad3" },
  { id: "gold", vi: "Vàng", en: "Gold", min: 10, color: "#e8b923" },
  { id: "platinum", vi: "Bạch kim", en: "Platinum", min: 25, color: "#8fe0d8" },
  { id: "diamond", vi: "Kim cương", en: "Diamond", min: 50, color: "#7cc8ff" },
];

export interface RankInfo {
  trades: number;
  tier: RankTier;
  next: RankTier | null;
  /** trades still missing for the next tier (0 at the top) */
  remaining: number;
}

export function rankForTrades(trades: number): RankInfo {
  const n = Math.max(0, Math.floor(trades) || 0);
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (n >= r.min) idx = i;
  });
  const next = RANKS[idx + 1] ?? null;
  return { trades: n, tier: RANKS[idx], next, remaining: next ? next.min - n : 0 };
}

// ---- client: batched, cached lookups (one request for every badge on a page)
const cache = new Map<string, number>();
const waiters = new Map<string, Array<(n: number) => void>>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const batch = Array.from(waiters.keys());
  const callbacks = new Map(waiters);
  waiters.clear();
  let trades: Record<string, number> = {};
  try {
    const res = await fetch(`/api/ranks?wallets=${encodeURIComponent(batch.join(","))}`);
    if (res.ok) trades = ((await res.json()) as { trades: Record<string, number> }).trades ?? {};
    batch.forEach((w) => cache.set(w, trades[w] ?? 0));
  } catch {
    // keep silent: a badge without data is simply not shown
    callbacks.forEach((list) => list.forEach((cb) => cb(-1)));
    return;
  }
  callbacks.forEach((list, w) => list.forEach((cb) => cb(cache.get(w) ?? 0)));
}

/** Completed trades of a wallet, or -1 when it could not be loaded. */
export function loadTrades(wallet: string): Promise<number> {
  const hit = cache.get(wallet);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((resolve) => {
    const list = waiters.get(wallet) ?? [];
    list.push(resolve);
    waiters.set(wallet, list);
    if (!timer) timer = setTimeout(flush, 30);
  });
}

/** Forget cached ranks (call after a trade completes so the badge refreshes). */
export function invalidateRanks() {
  cache.clear();
}
