import { NextRequest, NextResponse } from "next/server";
import { deleteArtworkForWallet, hideArtworkForWallet, unhideArtworkForWallet } from "@/lib/db/artworks";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet query param" }, { status: 400 });
  }
  try {
    if (searchParams.get("unhide")) {
      await unhideArtworkForWallet(mint, wallet);
      return NextResponse.json({ ok: true });
    }
    const deleted = await deleteArtworkForWallet(mint, wallet);
    // remember the deletion so the on-chain token scan does not bring the NFT back
    if (searchParams.get("hide") !== "0") await hideArtworkForWallet(mint, wallet);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("Delete artwork failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
