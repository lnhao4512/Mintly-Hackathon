import BN from "bn.js";

/**
 * Normalizes a user-provided secret string or hex into exactly 32 bytes.
 */
export function normalizeSecretTo32Bytes(secret: string): Uint8Array {
  const bytes = new Uint8Array(32);
  const trimmed = secret.trim();

  // If provided as 64-char hex string
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Otherwise UTF-8 encode up to 32 bytes
  const utf8 = new TextEncoder().encode(trimmed);
  bytes.set(utf8.slice(0, 32));
  return bytes;
}

/**
 * Generates a random secure 32-byte secret as hex string.
 */
export function generateRandomSecret(): string {
  const array = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Deterministic Commitment Computation:
 * SHA-256( amount.to_le_bytes(8) + secret(32) )
 * Exactly matches Anchor utils.rs::compute_bid_commitment
 */
export async function computeCommitmentHash(
  amountLamports: number | bigint | BN,
  secretStr: string
): Promise<{
  commitmentBytes: number[];
  commitmentHex: string;
  normalizedSecret: Uint8Array;
}> {
  let bnAmount: BN;
  if (amountLamports instanceof BN) {
    bnAmount = amountLamports;
  } else if (typeof amountLamports === "bigint") {
    bnAmount = new BN(amountLamports.toString());
  } else {
    bnAmount = new BN(Math.floor(amountLamports));
  }

  const amountLeBytes = bnAmount.toArrayLike(Uint8Array, "le", 8);
  const secretBytes = normalizeSecretTo32Bytes(secretStr);

  const payload = new Uint8Array(amountLeBytes.length + secretBytes.length);
  payload.set(amountLeBytes, 0);
  payload.set(secretBytes, amountLeBytes.length);

  // Compute SHA-256
  let hashBuffer: ArrayBuffer;
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    hashBuffer = await window.crypto.subtle.digest("SHA-256", payload as unknown as BufferSource);
  } else {
    // Fallback in Node / SSR
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(payload).digest();
    hashBuffer = hash.buffer;
  }

  const hashUint8 = new Uint8Array(hashBuffer);
  const commitmentBytes = Array.from(hashUint8);
  const commitmentHex = Array.from(hashUint8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    commitmentBytes,
    commitmentHex,
    normalizedSecret: secretBytes,
  };
}

/**
 * Bid secrets, persisted to MongoDB via /api/bids so a bidder never loses the
 * secret needed to reveal a winning bid by clearing storage or switching device.
 * An in-memory mirror below keeps existing synchronous render call sites working;
 * hydrate it first with hydrateBidSecretsForAuction / hydrateBidSecretsForBidder / hydrateAllBidSecrets.
 */
export interface SavedBidSecret {
  auctionPda: string;
  bidder: string;
  bidAmountSol: number;
  bidAmountLamports: number;
  secret: string;
  commitmentHex: string;
  timestamp: number;
}

let bidSecretsCache: SavedBidSecret[] = [];

function upsertBidLocal(item: SavedBidSecret) {
  const idx = bidSecretsCache.findIndex((x) => x.auctionPda === item.auctionPda && x.bidder === item.bidder);
  if (idx >= 0) bidSecretsCache[idx] = item;
  else bidSecretsCache.push(item);
}

export function saveBidSecretLocally(item: SavedBidSecret): void {
  upsertBidLocal(item);
  fetch("/api/bids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  }).catch((err) => console.warn("Failed to persist bid secret:", err));
}

export function getSavedBidSecret(auctionPda: string, bidder: string): SavedBidSecret | null {
  return (
    bidSecretsCache.find(
      (x) => x.auctionPda.toLowerCase() === auctionPda.toLowerCase() && x.bidder.toLowerCase() === bidder.toLowerCase()
    ) || null
  );
}

export function getAllSavedBidsForAuction(auctionPda: string, minTimestampMs: number = 0): SavedBidSecret[] {
  return bidSecretsCache
    .filter((x) => {
      const match = x.auctionPda.toLowerCase() === auctionPda.toLowerCase();
      if (!match) return false;
      if (minTimestampMs > 0 && x.timestamp && x.timestamp < minTimestampMs) return false;
      return true;
    })
    .sort((a, b) => b.bidAmountSol - a.bidAmountSol);
}

export function clearBidsForAuction(auctionPdaOrMint: string): void {
  if (!auctionPdaOrMint) return;
  const target = auctionPdaOrMint.toLowerCase().trim();
  bidSecretsCache = bidSecretsCache.filter(
    (x) => x.auctionPda.toLowerCase().trim() !== target && !x.auctionPda.toLowerCase().includes(target)
  );
  fetch(`/api/bids?auctionPdaOrMint=${encodeURIComponent(auctionPdaOrMint)}`, { method: "DELETE" }).catch((err) =>
    console.warn("Failed to clear bids for auction:", err)
  );
}

export function getUserActiveBids(bidder: string): SavedBidSecret[] {
  if (!bidder) return [];
  return bidSecretsCache.filter((x) => x.bidder.toLowerCase() === bidder.toLowerCase());
}

// ---- Hydration (call from useEffect before relying on the sync getters above) ----

export async function hydrateBidSecretsForAuction(auctionPda: string): Promise<void> {
  if (!auctionPda) return;
  try {
    const res = await fetch(`/api/bids?auctionPda=${encodeURIComponent(auctionPda)}`);
    const data = await res.json();
    (data?.bids || []).forEach(upsertBidLocal);
  } catch {
    // keep whatever is already cached
  }
}

export async function hydrateBidSecretsForBidder(bidder: string): Promise<void> {
  if (!bidder) return;
  try {
    const res = await fetch(`/api/bids?bidder=${encodeURIComponent(bidder)}`);
    const data = await res.json();
    (data?.bids || []).forEach(upsertBidLocal);
  } catch {
    // keep whatever is already cached
  }
}

export async function hydrateAllBidSecrets(): Promise<void> {
  try {
    const res = await fetch(`/api/bids?all=true`);
    const data = await res.json();
    (data?.bids || []).forEach(upsertBidLocal);
  } catch {
    // keep whatever is already cached
  }
}
