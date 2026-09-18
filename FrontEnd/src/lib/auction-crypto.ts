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
 * Client-side local storage helper for user bid secrets.
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

const STORAGE_KEY = "mintly_bid_secrets_v1";

export function saveBidSecretLocally(item: SavedBidSecret): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: SavedBidSecret[] = raw ? JSON.parse(raw) : [];
    // Replace if exists
    const idx = list.findIndex(
      (x) => x.auctionPda === item.auctionPda && x.bidder === item.bidder
    );
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to store bid secret locally:", err);
  }
}

export function getSavedBidSecret(
  auctionPda: string,
  bidder: string
): SavedBidSecret | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const list: SavedBidSecret[] = JSON.parse(raw);
    return (
      list.find(
        (x) =>
          x.auctionPda.toLowerCase() === auctionPda.toLowerCase() &&
          x.bidder.toLowerCase() === bidder.toLowerCase()
      ) || null
    );
  } catch {
    return null;
  }
}

export function getAllSavedBidsForAuction(auctionPda: string, minTimestampMs: number = 0): SavedBidSecret[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: SavedBidSecret[] = JSON.parse(raw);
    return list
      .filter((x) => {
        const match = x.auctionPda.toLowerCase() === auctionPda.toLowerCase();
        if (!match) return false;
        if (minTimestampMs > 0 && x.timestamp && x.timestamp < minTimestampMs) return false;
        return true;
      })
      .sort((a, b) => b.bidAmountSol - a.bidAmountSol);
  } catch {
    return [];
  }
}

export function clearBidsForAuction(auctionPdaOrMint: string): void {
  if (typeof window === "undefined" || !auctionPdaOrMint) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const list: SavedBidSecret[] = JSON.parse(raw);
    const target = auctionPdaOrMint.toLowerCase().trim();
    const filtered = list.filter(
      (x) => x.auctionPda.toLowerCase().trim() !== target && !x.auctionPda.toLowerCase().includes(target)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed to clear bids for auction:", err);
  }
}

export function getUserActiveBids(bidder: string): SavedBidSecret[] {
  if (typeof window === "undefined" || !bidder) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: SavedBidSecret[] = JSON.parse(raw);
    return list.filter((x) => x.bidder.toLowerCase() === bidder.toLowerCase());
  } catch {
    return [];
  }
}

