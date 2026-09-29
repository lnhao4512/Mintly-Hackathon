import { NextRequest, NextResponse } from "next/server";
import { deleteArtworkForWallet } from "@/lib/db/artworks";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet query param" }, { status: 400 });
  }
  await deleteArtworkForWallet(mint, wallet);
  return NextResponse.json({ ok: true });
}
