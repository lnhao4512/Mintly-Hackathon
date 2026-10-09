import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { endSession, getLive, listLive, pushFrame, startSession } from "@/lib/db/live";

export const runtime = "nodejs";

const MAX_FRAME_CHARS = 400_000;

function verify(wallet: string, message: string, signatureB64: string): boolean {
  try {
    return ed25519.verify(Uint8Array.from(Buffer.from(signatureB64, "base64")), new TextEncoder().encode(message), new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const creator = new URL(req.url).searchParams.get("creator");
  if (creator) return NextResponse.json({ session: await getLive(creator) });
  return NextResponse.json({ sessions: await listLive() });
}

/**
 * start: { action:"start", creator, title, nonce, signature } — the wallet signs `MINTLY_LIVE:<creator>:<nonce>`
 *        (Ed25519, proves control of the wallet); the server returns a random sessionId used as the write token.
 * frame: { action:"frame", sessionId, frame, title? } — latest canvas thumbnail.
 * end:   { action:"end", sessionId }
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.action) return NextResponse.json({ error: "action required" }, { status: 400 });

  if (b.action === "start") {
    if (!b.creator || !b.nonce || !verify(b.creator, `MINTLY_LIVE:${b.creator}:${b.nonce}`, b.signature ?? "")) {
      return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
    }
    const sessionId = crypto.randomUUID();
    await startSession({ sessionId, creator: b.creator, title: String(b.title || "Tác phẩm đang vẽ").slice(0, 80) });
    return NextResponse.json({ sessionId });
  }

  if (b.action === "frame") {
    if (typeof b.frame !== "string" || !b.frame.startsWith("data:image/") || b.frame.length > MAX_FRAME_CHARS) {
      return NextResponse.json({ error: "Invalid frame" }, { status: 400 });
    }
    const ok = await pushFrame(String(b.sessionId), b.frame, typeof b.title === "string" ? b.title.slice(0, 80) : undefined);
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  }

  if (b.action === "end") {
    await endSession(String(b.sessionId));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
