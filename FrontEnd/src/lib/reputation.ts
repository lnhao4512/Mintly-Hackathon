import type { Connection } from "@solana/web3.js";
import { getMarketplaceProgram } from "@/utils/anchor";

export interface Reputation {
  paid: number; // auctions the wallet won and paid in full (sales recorded after pay_balance)
  defaulted: number; // on-chain auctions with status DEFAULTED where the wallet was the highest bidder
  score: number; // 0-100
  tier: "new" | "trusted" | "risky";
}

/**
 * Buyer reputation derived from data we can verify:
 *  - defaults: read directly from Solana Auction accounts (status DEFAULTED, highest_bidder == wallet)
 *  - paid: settled sales (recorded after a successful pay_balance)
 * Limitation: an Auction PDA is reused on resale, so older defaults can be overwritten on-chain.
 */
export async function fetchReputation(connection: Connection, wallet: string): Promise<Reputation> {
  let defaulted = 0;
  try {
    const program = getMarketplaceProgram(connection);
    const auctions = await program.account.auction.all();
    defaulted = auctions.filter(
      (a: any) => a.account.status.defaulted !== undefined && a.account.highestBidder?.toBase58() === wallet
    ).length;
  } catch {
    // RPC unavailable: treat as unknown
  }

  let paid = 0;
  try {
    const res = await fetch(`/api/sales?wallet=${encodeURIComponent(wallet)}`);
    const { sales } = (await res.json()) as { sales: { buyer: string }[] };
    paid = sales.filter((s) => s.buyer.toLowerCase() === wallet.toLowerCase()).length;
  } catch {
    // ignore
  }

  const total = paid + defaulted;
  const score = total === 0 ? 50 : Math.round((paid / total) * 100);
  const tier: Reputation["tier"] = defaulted > 0 && score < 60 ? "risky" : paid >= 1 && defaulted === 0 ? "trusted" : "new";
  return { paid, defaulted, score, tier };
}
