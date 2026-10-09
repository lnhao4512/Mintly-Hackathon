import { Connection, PublicKey } from "@solana/web3.js";
import { getMarketplaceProgram } from "@/utils/anchor";
import type { Artwork } from "@/components/explore/ArtworkCard";
import { getArtworkByMint, hydrateArtworksByMints, NO_ARTWORK_IMAGE } from "@/lib/artworkCache";
import { SIMULATED_SELLERS } from "@/lib/config";

export type Auction = {
  id: string;
  image: string;
  title: string;
  currentBid: string;
  artist?: string;
  startPrice?: string;
  minIncrement?: string;
  startPriceLamports?: number;
  currentBidLamports?: number;
  highestBidder?: string | null;
  startTime?: number;
  endTime?: number;
  revealDeadline?: number;
  depositDeadline?: number;
  paymentDeadline?: number;
  depositPaid?: number;
  balancePaid?: number;
  status?: string;
  nftMint?: string;
  seller?: string;
  isLive?: boolean;
};

export interface CommitmentRecord {
  bidder: string;
  revealed: boolean;
  revealedAmountSol?: string;
  commitmentHex: string;
  timestamp?: number;
}

export interface MarketplaceStats {
  totalListings: number;
  activeAuctions: number;
  highestBidSol: string;
  totalVolumeSol: string;
  floorPriceSol: string;
  uniqueSellers: number;
}

export interface BidRecord {
  bidder: string;
  amountSol: string;
  timestamp: number;
}

export type DirectListing = {
  id: string;
  image: string;
  title: string;
  artist: string;
  price: string;
  priceLamports: number;
  nftMint: string;
  seller: string;
  expiry?: number;
  status?: string;
};

export function parseListingStatus(rawStatus: any): string {
  if (!rawStatus) return "ACTIVE";
  if (typeof rawStatus === "string") return rawStatus.toUpperCase();
  const key = Object.keys(rawStatus)[0];
  if (!key) return "ACTIVE";
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

/** Real metadata from MongoDB only. No stock art: a mint without a stored record gets a neutral tile. */
function getVisualForMint(mintStr: string, _index: number = 0) {
  const rec = getArtworkByMint(mintStr);
  return {
    title: rec?.title || `NFT ${mintStr.slice(0, 4)}…${mintStr.slice(-4)}`,
    image: rec?.imageUrl || NO_ARTWORK_IMAGE,
    rarity: (rec?.rarity || "collector") as "rare" | "collector" | "trending",
  };
}

function formatPubkey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Public lists only show works that have a stored, named record. Nameless on-chain items (bot/simulation runs,
 * works whose record was deleted) stay out of every listing and statistic; they remain reachable by direct link.
 */
async function onlyNamed<T extends { account: { nftMint: PublicKey } }>(items: T[]): Promise<T[]> {
  await hydrateArtworksByMints(items.map((i) => i.account.nftMint.toBase58()));
  return items.filter((i) => getArtworkByMint(i.account.nftMint.toBase58())?.title?.trim());
}

/**
 * Fetches all active on-chain Listings from Mintly Marketplace smart contract.
 */
export async function fetchLiveListings(connection: Connection): Promise<Artwork[]> {
  try {
    const program = getMarketplaceProgram(connection);
    const rawListings = await onlyNamed(await program.account.listing.all());

    return rawListings
      .filter((item: any) => parseListingStatus(item.account.status) === "ACTIVE")
      .map((item: any, idx: number) => {
        const nftMint = item.account.nftMint.toBase58();
        const seller = item.account.seller.toBase58();
        const priceLamports = item.account.price.toNumber();
        const priceSol = (priceLamports / 1e9).toFixed(2);
        const visual = getVisualForMint(nftMint, idx);

        return {
          id: item.publicKey.toBase58(),
          title: visual.title,
          artist: formatPubkey(seller),
          price: `${priceSol} SOL`,
          priceLabel: "Direct Sale",
          image: visual.image,
          rarity: visual.rarity,
          size: idx === 0 ? "large" : "small",
          href: `/listings/${item.publicKey.toBase58()}`,
          nftMint,
          sellerWallet: seller,
        };
      });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes("Failed to fetch") && !msg.includes("fetch failed")) {
      console.warn("Unable to fetch on-chain listings:", error);
    }
    return [];
  }
}

export function parseAuctionStatus(rawStatus: any): string {
  if (!rawStatus) return "LIVE";
  if (typeof rawStatus === "string") return rawStatus.toUpperCase();
  const key = Object.keys(rawStatus)[0];
  if (!key) return "LIVE";
  return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

let cachedLiveAuctions: Auction[] = [];

/**
 * Fetches all on-chain Auctions from Mintly Marketplace smart contract.
 */
export async function fetchLiveAuctions(connection: Connection): Promise<Auction[]> {
  try {
    const program = getMarketplaceProgram(connection);
    const rawAuctions = await onlyNamed((await program.account.auction.all()).filter((a: any) => !SIMULATED_SELLERS.has(a.account.seller.toBase58())));

    const parsed: Auction[] = rawAuctions.map((item: any, idx: number) => {
      const nftMint = item.account.nftMint.toBase58();
      const seller = item.account.seller.toBase58();
      const currentBidLamports = item.account.currentBid.toNumber();
      const startPriceLamports = item.account.startPrice.toNumber();
      const effectiveBidSol =
        currentBidLamports > 0
          ? (currentBidLamports / 1e9).toFixed(2)
          : (startPriceLamports / 1e9).toFixed(2);

      const visual = getVisualForMint(nftMint, idx + 1);
      const statusKey = parseAuctionStatus(item.account.status);
      const nowUnix = Math.floor(Date.now() / 1000);
      const endTimeNum = item.account.endTime ? item.account.endTime.toNumber() : 0;
      const isTimeEnded = endTimeNum > 0 && nowUnix >= endTimeNum;
      const isLive = (statusKey === "LIVE" || statusKey === "DRAFT") && !isTimeEnded;

      return {
        id: item.publicKey.toBase58(),
        title: visual.title,
        artist: formatPubkey(seller),
        currentBid: effectiveBidSol,
        startPrice: (startPriceLamports / 1e9).toFixed(2),
        image: visual.image,
        highestBidder: item.account.highestBidder ? item.account.highestBidder.toBase58() : null,
        endTime: endTimeNum,
        depositDeadline: item.account.depositDeadline ? item.account.depositDeadline.toNumber() : 0,
        paymentDeadline: item.account.paymentDeadline ? item.account.paymentDeadline.toNumber() : 0,
        status: statusKey,
        nftMint,
        seller,
        isLive,
      };
    });

    cachedLiveAuctions = parsed;
    return parsed;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes("Failed to fetch") && !msg.includes("fetch failed") && !msg.includes("429")) {
      console.warn("Unable to fetch on-chain auctions:", error);
    }
    return cachedLiveAuctions;
  }
}

/**
 * Fetches dynamic marketplace statistics aggregated directly from Solana program accounts.
 */
/**
 * Real settled volume: sum of prices of sales recorded after `pay_balance` succeeded.
 * Returns 0 when nothing has settled — never an extrapolated figure.
 */
export async function fetchSettledVolumeSol(): Promise<{ volumeSol: number; salesCount: number }> {
  try {
    const res = await fetch("/api/sales");
    if (!res.ok) return { volumeSol: 0, salesCount: 0 };
    const { sales } = (await res.json()) as { sales: { priceSol?: number }[] };
    const priced = sales.filter((s) => typeof s.priceSol === "number" && s.priceSol > 0);
    return { volumeSol: priced.reduce((sum, s) => sum + (s.priceSol as number), 0), salesCount: sales.length };
  } catch {
    return { volumeSol: 0, salesCount: 0 };
  }
}

export async function fetchMarketplaceStats(connection: Connection): Promise<MarketplaceStats> {
  try {
    const program = getMarketplaceProgram(connection);
    const [listings, auctions, settled] = await Promise.all([
      program.account.listing.all().then((all: any[]) => onlyNamed(all)),
      program.account.auction.all().then((all: any[]) => onlyNamed(all.filter((a) => !SIMULATED_SELLERS.has(a.account.seller.toBase58())))),
      fetchSettledVolumeSol(),
    ]);

    const activeListings = listings.filter(
      (l: any) => l.account.status.active !== undefined || l.account.status === "ACTIVE"
    );
    const activeAuctions = auctions.filter(
      (a: any) => a.account.status.live !== undefined || a.account.status === "LIVE"
    );

    let highestBid = 0;
    let floorPrice = Infinity;
    const sellers = new Set<string>();

    for (const l of activeListings) {
      const price = l.account.price.toNumber() / 1e9;
      if (price < floorPrice) floorPrice = price;
      sellers.add(l.account.seller.toBase58());
    }

    for (const a of activeAuctions) {
      const bid = a.account.currentBid.toNumber() / 1e9;
      const start = a.account.startPrice.toNumber() / 1e9;
      if (bid > highestBid) highestBid = bid;
      if (start < floorPrice) floorPrice = start;
      sellers.add(a.account.seller.toBase58());
    }

    if (floorPrice === Infinity) floorPrice = 0;

    return {
      totalListings: activeListings.length,
      activeAuctions: activeAuctions.length,
      highestBidSol: highestBid > 0 ? `${highestBid.toFixed(2)} SOL` : "0.00 SOL",
      floorPriceSol: floorPrice > 0 ? `${floorPrice.toFixed(2)} SOL` : "0.00 SOL",
      totalVolumeSol: `${settled.volumeSol.toFixed(2)} SOL`,
      uniqueSellers: sellers.size,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes("Failed to fetch") && !msg.includes("fetch failed")) {
      console.warn("Unable to calculate marketplace stats:", error);
    }
    return {
      totalListings: 0,
      activeAuctions: 0,
      highestBidSol: "0.00 SOL",
      floorPriceSol: "0.00 SOL",
      totalVolumeSol: "0.00 SOL",
      uniqueSellers: 0,
    };
  }
}

let cachedTotalVolume: { volume: number; timestamp: number } | null = null;

/**
 * Calculates total SOL volume of all bids placed across all auctions on the marketplace.
 */
export async function fetchTotalAuctionBidsVolume(connection: Connection): Promise<number> {
  const now = Date.now();
  if (cachedTotalVolume && now - cachedTotalVolume.timestamp < 30000) {
    return cachedTotalVolume.volume;
  }
  try {
    const auctions = await fetchLiveAuctions(connection);
    let total = 0;
    for (const a of auctions) {
      const bid = parseFloat(a.currentBid || "0");
      const start = parseFloat(a.startPrice || "0");
      total += (bid > 0 ? bid : start);
    }
    cachedTotalVolume = { volume: total, timestamp: now };
    return total;
  } catch {
    return cachedTotalVolume?.volume || 0;
  }
}

/**
 * Fetches an auction by PDA or Mint address.
 */
export async function fetchAuctionById(
  connection: Connection,
  id: string
): Promise<Auction | null> {
  try {
    const program = getMarketplaceProgram(connection);
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(id);
    } catch {
      return null;
    }

    let auctionPda = pubkey;
    let auctionAccount: any = null;
    try {
      auctionAccount = await program.account.auction.fetchNullable(pubkey);
    } catch {
      auctionAccount = null;
    }

    if (!auctionAccount) {
      const [derivedPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("auction"), pubkey.toBuffer()],
        program.programId
      );
      auctionPda = derivedPda;
      auctionAccount = await program.account.auction.fetchNullable(derivedPda);
    }

    if (!auctionAccount) return null;

    const nftMint = auctionAccount.nftMint.toBase58();
    await hydrateArtworksByMints([nftMint]);
    const seller = auctionAccount.seller.toBase58();
    const startPriceLamports = auctionAccount.startPrice ? auctionAccount.startPrice.toNumber() : 0;
    const currentBidLamports = auctionAccount.currentBid ? auctionAccount.currentBid.toNumber() : 0;
    const startPrice = (startPriceLamports / 1e9).toFixed(2);
    const currentBid = (currentBidLamports / 1e9).toFixed(2);
    const visual = getVisualForMint(nftMint);

    const now = Math.floor(Date.now() / 1000);
    const endTime = auctionAccount.endTime ? auctionAccount.endTime.toNumber() : undefined;
    const isLive = endTime ? now < endTime : true;
    const statusKey = parseAuctionStatus(auctionAccount.status);

    return {
      id: auctionPda.toBase58(),
      title: visual.title,
      startPrice,
      currentBid: currentBidLamports > 0 ? currentBid : startPrice,
      startPriceLamports,
      currentBidLamports,
      image: visual.image,
      highestBidder: auctionAccount.highestBidder
        ? auctionAccount.highestBidder.toBase58()
        : null,
      startTime: auctionAccount.startTime ? auctionAccount.startTime.toNumber() : undefined,
      endTime: auctionAccount.endTime ? auctionAccount.endTime.toNumber() : undefined,
      revealDeadline: auctionAccount.revealDeadline ? auctionAccount.revealDeadline.toNumber() : undefined,
      depositDeadline: auctionAccount.depositDeadline ? auctionAccount.depositDeadline.toNumber() : undefined,
      paymentDeadline: auctionAccount.paymentDeadline ? auctionAccount.paymentDeadline.toNumber() : undefined,
      depositPaid: auctionAccount.depositPaid ? auctionAccount.depositPaid.toNumber() : 0,
      balancePaid: auctionAccount.balancePaid ? auctionAccount.balancePaid.toNumber() : 0,
      status: statusKey,
      nftMint,
      seller,
      isLive,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes("Account does not exist") && !msg.includes("429")) {
      console.error("Failed to fetch auction by id:", error);
    }
    return null;
  }
}

const commitmentsCache = new Map<string, { data: CommitmentRecord[]; timestamp: number }>();

/**
 * Fetches all BidCommitments submitted on-chain for an auction.
 */
export async function fetchCommitmentsForAuction(
  connection: Connection,
  auctionPubkey: PublicKey
): Promise<CommitmentRecord[]> {
  const key = auctionPubkey.toBase58();
  const cached = commitmentsCache.get(key);
  const now = Date.now();
  if (cached && now - cached.timestamp < 15000) {
    return cached.data;
  }

  try {
    const program = getMarketplaceProgram(connection);
    const rawCommitments = await program.account.bidCommitment.all([
      {
        memcmp: {
          offset: 8, // after discriminator (auction pubkey is first field)
          bytes: auctionPubkey.toBase58(),
        },
      },
    ]);

    const results = rawCommitments.map((item: any) => {
      const commitmentArr: number[] = item.account.commitment;
      const hex = Array.from(commitmentArr)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const revealed = !!item.account.revealed;
      const revealedLamports = item.account.revealedAmount?.toNumber() || 0;

      return {
        bidder: item.account.bidder.toBase58(),
        revealed,
        revealedAmountSol: revealed ? `${(revealedLamports / 1e9).toFixed(2)} SOL` : undefined,
        commitmentHex: hex,
      };
    });

    commitmentsCache.set(key, { data: results, timestamp: now });
    return results;
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (!msg.includes("429")) {
      console.warn("Unable to fetch bid commitments:", error);
    }
    return cached?.data || [];
  }
}

export async function fetchListingById(
  connection: Connection,
  id: string
): Promise<DirectListing | null> {
  try {
    const program = getMarketplaceProgram(connection);
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(id);
    } catch {
      return null;
    }

    let listingPda = pubkey;
    let listingAccount: any = null;
    try {
      listingAccount = await program.account.listing.fetchNullable(pubkey);
    } catch {
      listingAccount = null;
    }

    if (!listingAccount) {
      const [derivedPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), pubkey.toBuffer()],
        program.programId
      );
      listingPda = derivedPda;
      listingAccount = await program.account.listing.fetchNullable(derivedPda);
    }

    if (!listingAccount) return null;

    const nftMint = listingAccount.nftMint.toBase58();
    await hydrateArtworksByMints([nftMint]);
    const seller = listingAccount.seller.toBase58();
    const priceLamports = listingAccount.price.toNumber();
    const visual = getVisualForMint(nftMint, 0);
    const statusKey = parseListingStatus(listingAccount.status);

    return {
      id: listingPda.toBase58(),
      title: visual.title,
      artist: formatPubkey(seller),
      image: visual.image,
      price: `${(priceLamports / 1e9).toFixed(2)} SOL`,
      priceLamports,
      nftMint,
      seller,
      expiry: listingAccount.expiry.toNumber(),
      status: statusKey,
    };
  } catch (error) {
    console.error("Failed to fetch listing by id:", error);
    return null;
  }
}

export async function fetchSellerListings(
  connection: Connection,
  seller: PublicKey
): Promise<DirectListing[]> {
  try {
    const program = getMarketplaceProgram(connection);
    const rawListings = await program.account.listing.all([
      {
        memcmp: {
          offset: 8,
          bytes: seller.toBase58(),
        },
      },
    ]);

    return rawListings
      .map((item: any, idx: number) => {
        const nftMint = item.account.nftMint.toBase58();
        const sellerStr = item.account.seller.toBase58();
        const priceLamports = item.account.price.toNumber();
        const visual = getVisualForMint(nftMint, idx);

        return {
          id: item.publicKey.toBase58(),
          title: visual.title,
          artist: formatPubkey(sellerStr),
          image: visual.image,
          price: `${(priceLamports / 1e9).toFixed(2)} SOL`,
          priceLamports,
          nftMint,
          seller: sellerStr,
          expiry: item.account.expiry.toNumber(),
          status: parseListingStatus(item.account.status),
        } satisfies DirectListing;
      })
      .sort((a: DirectListing, b: DirectListing) => (b.expiry || 0) - (a.expiry || 0));
  } catch (error) {
    console.error("Failed to fetch seller listings:", error);
    return [];
  }
}

/**
 * Fetches all bids submitted on-chain for a specific auction.
 */
export async function fetchBidsForAuction(
  connection: Connection,
  auctionPubkey: PublicKey
): Promise<BidRecord[]> {
  try {
    const program = getMarketplaceProgram(connection);
    const rawBids = await program.account.bid.all([
      {
        memcmp: {
          offset: 8, // after discriminator
          bytes: auctionPubkey.toBase58(),
        },
      },
    ]);

    return rawBids
      .map((b: any) => ({
        bidder: formatPubkey(b.account.bidder.toBase58()),
        amountSol: `${(b.account.amount.toNumber() / 1e9).toFixed(2)} SOL`,
        timestamp: b.account.timestamp.toNumber(),
      }))
      .sort((a: BidRecord, b: BidRecord) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to fetch bids for auction:", error);
    return [];
  }
}

// Backward-compatibility exports
export const artworks: Artwork[] = [];
export const auctionCatalog: Auction[] = [];
export const featuredAuction: Auction | undefined = undefined;
export function getAuctionById(_id: string): Auction | undefined {
  return undefined;
}
