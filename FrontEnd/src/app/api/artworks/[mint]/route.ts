import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { deleteArtworkForWallet, hideArtworkForWallet, unhideArtworkForWallet } from "@/lib/db/artworks";

export const runtime = "nodejs";

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;

/** The wallet must have signed `MINTLY_DELETE:<mint>:<wallet>:<ts>` (Ed25519, signMessage). */
function verifyDeleteSignature(mint: string, wallet: string, ts: string | null, signatureB64: string | null): boolean {
  try {
    const t = Number(ts);
    if (!ts || !signatureB64 || !Number.isFinite(t) || Math.abs(Date.now() - t) > MAX_SIGNATURE_AGE_MS) return false;
    const sig = Uint8Array.from(Buffer.from(signatureB64, "base64"));
    const msg = new TextEncoder().encode(`MINTLY_DELETE:${mint}:${wallet}:${ts}`);
    return ed25519.verify(sig, msg, new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

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
    if (!verifyDeleteSignature(mint, wallet, searchParams.get("ts"), searchParams.get("sig"))) {
      return NextResponse.json({ error: "Missing or invalid wallet signature" }, { status: 401 });
    }
    const deleted = await deleteArtworkForWallet(mint, wallet);
    // remember the deletion so the on-chain token scan does not bring the NFT back
    await hideArtworkForWallet(mint, wallet);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("Delete artwork failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
