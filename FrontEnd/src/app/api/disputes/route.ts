import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { createDispute, listDisputes, resolveDispute } from "@/lib/db/disputes";
import { RPC_ENDPOINT, getConfigPda } from "@/lib/config";

export const runtime = "nodejs";

function verifySignature(wallet: string, message: string, signatureB64: string): boolean {
  try {
    const sig = Uint8Array.from(Buffer.from(signatureB64, "base64"));
    return ed25519.verify(sig, new TextEncoder().encode(message), new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

/** MarketplaceConfig.authority = first pubkey after the 8-byte Anchor discriminator. */
async function readAuthority(): Promise<string | null> {
  const info = await new Connection(RPC_ENDPOINT, "confirmed").getAccountInfo(getConfigPda()[0]);
  if (!info || info.data.length < 40) return null;
  return new PublicKey(info.data.subarray(8, 40)).toBase58();
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status") as "open" | "upheld" | "rejected" | null;
  const disputes = await listDisputes({ mintAddress: sp.get("mint") ?? undefined, status: status ?? undefined });
  return NextResponse.json({ disputes });
}

/**
 * Report: body { mintAddress, reporter, reason, evidenceUrl?, signature } where the wallet signed
 * `MINTLY_DISPUTE:<mintAddress>:<reason>` (Ed25519 via signMessage) — proves control of `reporter`.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.mintAddress || !b?.reporter || typeof b.reason !== "string" || b.reason.trim().length < 10) {
    return NextResponse.json({ error: "mintAddress, reporter and a reason (>= 10 chars) are required" }, { status: 400 });
  }
  const reason = b.reason.trim().slice(0, 1000);
  if (!verifySignature(b.reporter, `MINTLY_DISPUTE:${b.mintAddress}:${b.reason}`, b.signature ?? "")) {
    return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
  }
  const evidenceUrl = typeof b.evidenceUrl === "string" && /^https?:\/\//.test(b.evidenceUrl) ? b.evidenceUrl.slice(0, 500) : undefined;
  const dispute = await createDispute({ mintAddress: b.mintAddress, reporter: b.reporter, reason, evidenceUrl });
  return NextResponse.json({ dispute });
}

/**
 * Resolve (admin only): body { id, status, admin, signature } where the marketplace authority signed
 * `MINTLY_RESOLVE:<id>:<status>`. The authority is read from the on-chain MarketplaceConfig.
 */
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b?.id || !["upheld", "rejected"].includes(b.status) || !b.admin) {
    return NextResponse.json({ error: "id, status and admin are required" }, { status: 400 });
  }
  const authority = await readAuthority();
  if (!authority || authority !== b.admin) {
    return NextResponse.json({ error: "Not the marketplace authority" }, { status: 403 });
  }
  if (!verifySignature(b.admin, `MINTLY_RESOLVE:${b.id}:${b.status}`, b.signature ?? "")) {
    return NextResponse.json({ error: "Invalid wallet signature" }, { status: 401 });
  }
  const ok = await resolveDispute(b.id, b.status, b.admin);
  return NextResponse.json({ ok });
}
