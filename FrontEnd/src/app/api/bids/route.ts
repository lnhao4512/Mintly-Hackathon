import { NextRequest, NextResponse } from "next/server";
import { saveBidSecret, getBidSecret, getBidsForAuction, getBidsForBidder, getAllBidSecrets, clearBidsForAuction } from "@/lib/db/bidSecrets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const auctionPda = searchParams.get("auctionPda");
  const bidder = searchParams.get("bidder");
  const all = searchParams.get("all");
  const minTimestampMs = Number(searchParams.get("minTimestampMs") || 0);

  if (auctionPda && bidder) {
    const secret = await getBidSecret(auctionPda, bidder);
    return NextResponse.json({ secret });
  }
  if (auctionPda) {
    const bids = await getBidsForAuction(auctionPda, minTimestampMs);
    return NextResponse.json({ bids });
  }
  if (bidder) {
    const bids = await getBidsForBidder(bidder);
    return NextResponse.json({ bids });
  }
  if (all) {
    const bids = await getAllBidSecrets();
    return NextResponse.json({ bids });
  }
  return NextResponse.json({ error: "Missing auctionPda, bidder or all query param" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.auctionPda || !body?.bidder) {
    return NextResponse.json({ error: "auctionPda and bidder are required" }, { status: 400 });
  }
  await saveBidSecret(body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const auctionPdaOrMint = searchParams.get("auctionPdaOrMint");
  if (!auctionPdaOrMint) {
    return NextResponse.json({ error: "Missing auctionPdaOrMint query param" }, { status: 400 });
  }
  await clearBidsForAuction(auctionPdaOrMint);
  return NextResponse.json({ ok: true });
}
