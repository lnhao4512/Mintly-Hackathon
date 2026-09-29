import { NextRequest, NextResponse } from "next/server";
import { upsertSecondaryAuction, findSecondaryAuction, getAllSecondaryAuctions, updateSecondaryAuctionBid } from "@/lib/db/secondaryAuctions";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const auction = await findSecondaryAuction(id);
    return NextResponse.json({ auction });
  }
  const auctions = await getAllSecondaryAuctions();
  return NextResponse.json({ auctions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.id || !body?.nftMint) {
    return NextResponse.json({ error: "id and nftMint are required" }, { status: 400 });
  }
  await upsertSecondaryAuction(body);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body?.pdaOrMint || typeof body?.highestBidSol !== "number") {
    return NextResponse.json({ error: "pdaOrMint and highestBidSol are required" }, { status: 400 });
  }
  await updateSecondaryAuctionBid(body.pdaOrMint, body.highestBidSol);
  return NextResponse.json({ ok: true });
}
