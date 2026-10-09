/**
 * Client-side helpers backed by MongoDB (see /api/artworks, /api/sales).
 * Data is persisted server-side; this module keeps an in-memory mirror hydrated via the
 * hydrate* functions so existing synchronous render/filter call sites keep working.
 * Auction round data itself (price, status, resale rounds) lives on-chain — see lib/data.ts.
 */

export interface MintedArtworkRecord {
  mintAddress: string;
  title: string;
  description: string;
  imageUrl: string;
  creator: string;
  createdAt: number;
  signature?: string;
  category?: string;
  rarity?: "rare" | "collector" | "trending";
  originalityScore?: number | null;
}

export interface SoldArtworkRecord {
  mintAddress: string;
  seller: string;
  buyer: string;
  soldAt: number;
  auctionPda?: string;
  priceSol?: number;
}

/** Neutral tile shown when an NFT has no stored artwork metadata — never a stock picture. */
export const NO_ARTWORK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#171716"/><rect x="40" y="40" width="320" height="320" fill="none" stroke="#3a3a37" stroke-width="1"/><path d="M40 40L360 360M360 40L40 360" stroke="#262624" stroke-width="1"/></svg>'
  );

let artworksCache: MintedArtworkRecord[] = [];
let salesCache: SoldArtworkRecord[] = [];

async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function postJson(url: string, body: unknown): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => console.warn("Failed to persist to MongoDB:", err));
}

function upsertArtworkLocal(record: MintedArtworkRecord) {
  const idx = artworksCache.findIndex((a) => a.mintAddress.toLowerCase() === record.mintAddress.toLowerCase());
  if (idx >= 0) artworksCache[idx] = record;
  else artworksCache.unshift(record);
}

// ---- Hydration (call from useEffect before relying on the sync getters below) ----

export async function hydrateArtworksForWallet(wallet: string): Promise<void> {
  if (!wallet) return;
  const data = await safeFetchJson<{ artworks: MintedArtworkRecord[] }>(
    `/api/artworks?creator=${encodeURIComponent(wallet)}`
  );
  (data?.artworks || []).forEach(upsertArtworkLocal);
}

export async function hydrateArtworkByMint(mintAddress: string): Promise<void> {
  if (!mintAddress) return;
  const data = await safeFetchJson<{ artwork: MintedArtworkRecord | null }>(
    `/api/artworks?mint=${encodeURIComponent(mintAddress)}`
  );
  if (data?.artwork) upsertArtworkLocal(data.artwork);
}

/** Load artwork metadata (title/image) for mints we don't own, so every visitor sees the same picture. */
export async function hydrateArtworksByMints(mints: string[]): Promise<void> {
  const missing = Array.from(new Set(mints)).filter((m) => m && !getArtworkByMint(m));
  await Promise.all(missing.map((m) => hydrateArtworkByMint(m)));
}

export async function hydrateSales(): Promise<void> {
  const data = await safeFetchJson<{ sales: SoldArtworkRecord[] }>("/api/sales");
  if (data?.sales) salesCache = data.sales;
}

export async function fetchSaleHistoryForMint(mintAddress: string): Promise<SoldArtworkRecord[]> {
  if (!mintAddress) return [];
  const data = await safeFetchJson<{ sales: SoldArtworkRecord[] }>(`/api/sales?mint=${encodeURIComponent(mintAddress)}`);
  return data?.sales || [];
}

export async function hydrateAllCaches(wallet?: string): Promise<void> {
  await Promise.all([wallet ? hydrateArtworksForWallet(wallet) : Promise.resolve(), hydrateSales()]);
}

// ---- Artworks / portfolio ----

export function saveMintedArtwork(record: MintedArtworkRecord): void {
  upsertArtworkLocal(record);
  postJson("/api/artworks", record);
}

export function getArtworkByMint(mintAddress: string): MintedArtworkRecord | null {
  if (!mintAddress) return null;
  return artworksCache.find((a) => a.mintAddress.toLowerCase() === mintAddress.toLowerCase()) || null;
}

export function getArtworkImage(mintAddress: string): string | null {
  return getArtworkByMint(mintAddress)?.imageUrl || null;
}

export function getWonArtworksForBuyer(buyerWallet: string): MintedArtworkRecord[] {
  if (!buyerWallet) return [];
  const walletNorm = buyerWallet.toLowerCase().trim();
  const won: MintedArtworkRecord[] = [];
  const sorted = [...salesCache].sort((a, b) => (b.soldAt || 0) - (a.soldAt || 0));
  const seenMints = new Set<string>();

  for (const sale of sorted) {
    const mintNorm = sale.mintAddress.toLowerCase().trim();
    if (seenMints.has(mintNorm)) continue;
    seenMints.add(mintNorm);

    if (sale.buyer.toLowerCase().trim() === walletNorm) {
      const art = getArtworkByMint(sale.mintAddress);
      won.push({
        mintAddress: sale.mintAddress,
        title: art?.title || `Tác phẩm Mint #${sale.mintAddress.slice(0, 4)}`,
        description:
          art?.description ||
          `Tác phẩm NFT đã được thanh toán (${sale.priceSol ? `${sale.priceSol} SOL` : "90%"}) & ghi nhận quyền sở hữu on-chain trên ví của bạn.`,
        imageUrl: art?.imageUrl || NO_ARTWORK_IMAGE,
        creator: sale.buyer,
        createdAt: sale.soldAt || Date.now(),
        category: "Đấu Giá Thắng Cuộc",
        rarity: art?.rarity || "collector",
      });
    }
  }
  return won;
}

export function getUserMintedArtworks(walletAddress: string): MintedArtworkRecord[] {
  if (!walletAddress) return [];
  const walletNorm = walletAddress.toLowerCase().trim();

  let list = artworksCache.filter((a) => a.creator.toLowerCase().trim() === walletNorm);
  list = list.filter((x) => !isArtworkSoldBySeller(x.mintAddress, walletAddress));

  const won = getWonArtworksForBuyer(walletAddress);
  won.forEach((w) => {
    const idx = list.findIndex((x) => x.mintAddress.toLowerCase().trim() === w.mintAddress.toLowerCase().trim());
    if (idx >= 0) list[idx] = w;
    else list.unshift(w);
  });

  return list;
}

export function deleteMintedArtwork(mintAddress: string, walletAddress: string): void {
  artworksCache = artworksCache.filter(
    (a) => !(a.mintAddress.toLowerCase() === mintAddress.toLowerCase() && a.creator.toLowerCase() === walletAddress.toLowerCase())
  );
  fetch(`/api/artworks/${encodeURIComponent(mintAddress)}?wallet=${encodeURIComponent(walletAddress)}`, {
    method: "DELETE",
  }).catch((err) => console.warn("Failed to delete artwork:", err));
}

// Ownership transfer (via markArtworkAsSold re-assigning `creator`) replaces the old hidden-mint
// hack; kept as no-ops so existing call sites don't need to change.
export function getHiddenMints(_walletAddress: string): string[] {
  return [];
}
export function unhideArtwork(_mintAddress: string, _walletAddress: string): void {}

export function markArtworkAsSold(record: SoldArtworkRecord): void {
  salesCache.unshift(record);
  postJson("/api/sales", record);

  const art = getArtworkByMint(record.mintAddress);
  saveMintedArtwork({
    mintAddress: record.mintAddress,
    title: art?.title || `Tác phẩm #${record.mintAddress.slice(0, 4)}`,
    description: art?.description || `Tác phẩm NFT đã được thanh toán & ghi nhận quyền sở hữu on-chain trên ví của bạn.`,
    imageUrl: art?.imageUrl || NO_ARTWORK_IMAGE,
    creator: record.buyer,
    createdAt: record.soldAt || Date.now(),
    category: "Đấu Giá Thắng Cuộc",
    rarity: art?.rarity || "collector",
  });
}

export function isArtworkSoldBySeller(mintAddress: string, walletAddress: string): boolean {
  if (!mintAddress || !walletAddress) return false;
  const walletNorm = walletAddress.toLowerCase().trim();
  const mintNorm = mintAddress.toLowerCase().trim();

  const sorted = salesCache
    .filter((x) => x.mintAddress.toLowerCase().trim() === mintNorm)
    .sort((a, b) => (b.soldAt || 0) - (a.soldAt || 0));

  if (sorted.length === 0) return false;

  const latest = sorted[0];
  if (latest.buyer.toLowerCase().trim() === walletNorm) return false;
  if (latest.seller.toLowerCase().trim() === walletNorm) return true;
  return false;
}

export function isAuctionSettled(auctionPdaOrMint: string, minTimestampMs: number = 0): boolean {
  if (!auctionPdaOrMint) return false;
  const target = auctionPdaOrMint.toLowerCase().trim();

  return salesCache.some(
    (x) =>
      ((x.auctionPda && x.auctionPda.toLowerCase().trim() === target) ||
        x.mintAddress.toLowerCase().trim() === target ||
        (x.auctionPda && target.includes(x.auctionPda.toLowerCase().trim())) ||
        (x.mintAddress && target.includes(x.mintAddress.toLowerCase().trim()))) &&
      (minTimestampMs === 0 || (x.soldAt !== undefined && x.soldAt >= minTimestampMs))
  );
}
