import { NextRequest, NextResponse } from "next/server";
import { upsertArtwork, getArtworksByCreator, getArtworkByMint, getHiddenMintsForWallet } from "@/lib/db/artworks";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const creator = searchParams.get("creator");
  const mint = searchParams.get("mint");
  const hidden = searchParams.get("hidden");

  if (hidden) {
    return NextResponse.json({ hidden: await getHiddenMintsForWallet(hidden) });
  }

  if (mint) {
    const art = await getArtworkByMint(mint);
    return NextResponse.json({ artwork: art });
  }
  if (creator) {
    const artworks = await getArtworksByCreator(creator);
    return NextResponse.json({ artworks });
  }
  return NextResponse.json({ error: "Missing creator or mint query param" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.mintAddress || !body?.creator) {
    return NextResponse.json({ error: "mintAddress and creator are required" }, { status: 400 });
  }
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  await upsertArtwork(body);
  return NextResponse.json({ ok: true });
}
