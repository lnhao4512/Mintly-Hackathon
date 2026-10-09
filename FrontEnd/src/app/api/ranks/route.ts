import { NextRequest, NextResponse } from "next/server";
import { countTradesForWallets } from "@/lib/db/sales";

export const runtime = "nodejs";

/** GET /api/ranks?wallets=a,b,c -> { trades: { a: 12, b: 0 } } (completed trades as seller or buyer). */
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("wallets") ?? "";
  const wallets = Array.from(new Set(raw.split(",").map((w) => w.trim()).filter((w) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)))).slice(0, 60);
  try {
    return NextResponse.json({ trades: await countTradesForWallets(wallets) });
  } catch (err) {
    console.error("ranks failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
