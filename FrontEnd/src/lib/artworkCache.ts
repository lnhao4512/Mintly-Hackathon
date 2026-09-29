/**
 * Client-side helpers backed by MongoDB (see /api/artworks, /api/sales, /api/auctions/secondary).
 * Data is persisted server-side; this module keeps an in-memory mirror hydrated via the
 * hydrate* functions so existing synchronous render/filter call sites keep working.
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
}

export interface SoldArtworkRecord {
  mintAddress: string;
  seller: string;
  buyer: string;
  soldAt: number;
  auctionPda?: string;
  priceSol?: number;
}

export interface CustomAuctionRecord {
  id: string;
  nftMint: string;
  seller: string;
  startPrice: string;
  currentBid: string;
  minIncrement: string;
  startTime: number;
  endTime: number;
  revealDeadline: number;
  depositDeadline: number;
  paymentDeadline: number;
  status: string;
  title: string;
  image: string;
  createdAt: number;
}

let artworksCache: MintedArtworkRecord[] = [];
let salesCache: SoldArtworkRecord[] = [];
let secondaryAuctionsCache: CustomAuctionRecord[] = [];

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

export async function hydrateSales(): Promise<void> {
  const data = await safeFetchJson<{ sales: SoldArtworkRecord[] }>("/api/sales");
  if (data?.sales) salesCache = data.sales;
}

export async function hydrateSecondaryAuctions(): Promise<void> {
  const data = await safeFetchJson<{ auctions: CustomAuctionRecord[] }>("/api/auctions/secondary");
  if (data?.auctions) secondaryAuctionsCache = data.auctions;
}

export async function hydrateAllCaches(wallet?: string): Promise<void> {
  await Promise.all([
    wallet ? hydrateArtworksForWallet(wallet) : Promise.resolve(),
    hydrateSales(),
    hydrateSecondaryAuctions(),
  ]);
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
        imageUrl: art?.imageUrl || "/assets/messi-symphony.svg",
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
    imageUrl: art?.imageUrl || "/assets/messi-symphony.svg",
    creator: record.buyer,
    createdAt: record.soldAt || Date.now(),
    category: "Đấu Giá Thắng Cuộc",
    rarity: art?.rarity || "collector",
  });

  const secondary =
    getSecondaryAuction(record.mintAddress) || (record.auctionPda ? getSecondaryAuction(record.auctionPda) : null);
  if (secondary) {
    saveSecondaryAuction({ ...secondary, status: "SETTLED" });
  }
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

// ---- Secondary (resale) auctions ----

export function saveSecondaryAuction(record: CustomAuctionRecord): void {
  const idx = secondaryAuctionsCache.findIndex(
    (x) => x.id.toLowerCase() === record.id.toLowerCase() || x.nftMint.toLowerCase() === record.nftMint.toLowerCase()
  );
  if (idx >= 0) secondaryAuctionsCache[idx] = record;
  else secondaryAuctionsCache.unshift(record);
  postJson("/api/auctions/secondary", record);
}

export function getSecondaryAuction(pdaOrMint: string): CustomAuctionRecord | null {
  if (!pdaOrMint) return null;
  const target = pdaOrMint.toLowerCase().trim();
  return (
    secondaryAuctionsCache.find(
      (x) =>
        x.id.toLowerCase().trim() === target ||
        x.nftMint.toLowerCase().trim() === target ||
        target.includes(x.id.toLowerCase().trim()) ||
        target.includes(x.nftMint.toLowerCase().trim()) ||
        x.id.toLowerCase().trim().includes(target) ||
        x.nftMint.toLowerCase().trim().includes(target)
    ) || null
  );
}

export function updateSecondaryAuctionBid(pdaOrMint: string, highestBidSol: number, _highestBidder: string): void {
  const found = getSecondaryAuction(pdaOrMint);
  if (found) {
    found.currentBid = highestBidSol.toFixed(2);
  }
  fetch("/api/auctions/secondary", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdaOrMint, highestBidSol }),
  }).catch((err) => console.warn("Failed to update secondary auction bid:", err));
}

export function getAllSecondaryAuctions(): CustomAuctionRecord[] {
  return secondaryAuctionsCache;
}

export function isAuctionSettled(auctionPdaOrMint: string, minTimestampMs: number = 0): boolean {
  if (!auctionPdaOrMint) return false;
  const target = auctionPdaOrMint.toLowerCase().trim();

  const secondary = getSecondaryAuction(target);
  if (secondary) {
    return secondary.status?.toUpperCase() === "SETTLED";
  }

  return salesCache.some(
    (x) =>
      ((x.auctionPda && x.auctionPda.toLowerCase().trim() === target) ||
        x.mintAddress.toLowerCase().trim() === target ||
        (x.auctionPda && target.includes(x.auctionPda.toLowerCase().trim())) ||
        (x.mintAddress && target.includes(x.mintAddress.toLowerCase().trim()))) &&
      (minTimestampMs === 0 || (x.soldAt !== undefined && x.soldAt >= minTimestampMs))
  );
}
