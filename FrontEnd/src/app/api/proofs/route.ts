import { NextRequest, NextResponse } from "next/server";
import { getProof, saveProof } from "@/lib/db/proofs";

const MAX_BODY_CHARS = 3_000_000;

export async function GET(req: NextRequest) {
  const mint = new URL(req.url).searchParams.get("mint");
  if (!mint) return NextResponse.json({ error: "mint is required" }, { status: 400 });
  return NextResponse.json({ proof: await getProof(mint) });
}

export async function POST(req: NextRequest) {
  const text = await req.text();
  if (text.length > MAX_BODY_CHARS) return NextResponse.json({ error: "Proof too large" }, { status: 413 });
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!b?.mintAddress || !b?.creator || !/^[0-9a-f]{64}$/.test(b?.proofHash ?? "") || !Array.isArray(b.frames)) {
    return NextResponse.json({ error: "mintAddress, creator, proofHash and frames are required" }, { status: 400 });
  }
  await saveProof({
    mintAddress: b.mintAddress,
    creator: b.creator,
    method: b.method === "imported" ? "imported" : "drawn",
    strokes: Number(b.strokes) || 0,
    durationMs: Number(b.durationMs) || 0,
    frames: b.frames.filter((f: unknown) => typeof f === "string" && f.startsWith("data:image/")).slice(0, 60),
    proofHash: b.proofHash,
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
