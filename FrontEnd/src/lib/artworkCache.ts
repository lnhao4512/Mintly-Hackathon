const PREFIX = "mintly:art:";
const PORTFOLIO_PREFIX = "mintly:portfolio:";

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

export function saveArtworkImage(mintAddress: string, dataUrl: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${mintAddress}`, dataUrl);
  } catch {
    // Ignore quota / private mode failures
  }
}

export function getArtworkImage(mintAddress: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${PREFIX}${mintAddress}`);
  } catch {
    return null;
  }
}

export function saveMintedArtwork(record: MintedArtworkRecord) {
  if (typeof window === "undefined") return;
  try {
    // Save image to art prefix
    saveArtworkImage(record.mintAddress, record.imageUrl);

    // Save item to wallet portfolio list
    const walletKey = `${PORTFOLIO_PREFIX}${record.creator}`;
    const existingRaw = window.localStorage.getItem(walletKey);
    const list: MintedArtworkRecord[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Check if already exists
    const idx = list.findIndex((x) => x.mintAddress === record.mintAddress);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }

    window.localStorage.setItem(walletKey, JSON.stringify(list));

    // Also maintain a global minted list
    const globalKey = `${PORTFOLIO_PREFIX}all`;
    const globalRaw = window.localStorage.getItem(globalKey);
    const globalList: MintedArtworkRecord[] = globalRaw ? JSON.parse(globalRaw) : [];
    const gIdx = globalList.findIndex((x) => x.mintAddress === record.mintAddress);
    if (gIdx >= 0) {
      globalList[gIdx] = record;
    } else {
      globalList.unshift(record);
    }
    window.localStorage.setItem(globalKey, JSON.stringify(globalList));
  } catch (err) {
    console.warn("Failed to persist minted artwork to localStorage:", err);
  }
}

export function getWonArtworksForBuyer(buyerWallet: string): MintedArtworkRecord[] {
  if (typeof window === "undefined" || !buyerWallet) return [];
  const wonList: MintedArtworkRecord[] = [];
  const walletNorm = buyerWallet.toLowerCase().trim();

  try {
    const raw = window.localStorage.getItem(SOLD_KEY);
    if (raw) {
      const list: SoldArtworkRecord[] = JSON.parse(raw);
      // Sort sales descending by soldAt to get most recent sales first
      const sorted = [...list].sort((a, b) => (b.soldAt || 0) - (a.soldAt || 0));

      const seenMints = new Set<string>();
      for (const sale of sorted) {
        const mintNorm = sale.mintAddress.toLowerCase().trim();
        if (seenMints.has(mintNorm)) continue;
        seenMints.add(mintNorm);

        // If the latest owner of this mint is the buyerWallet, then they currently own it!
        if (sale.buyer.toLowerCase().trim() === walletNorm) {
          const art = getArtworkByMint(sale.mintAddress);
          const cachedImage = getArtworkImage(sale.mintAddress) || art?.imageUrl || "/assets/messi-symphony.svg";
          wonList.push({
            mintAddress: sale.mintAddress,
            title: art?.title || `Tác phẩm Mint #${sale.mintAddress.slice(0, 4)}`,
            description: art?.description || `Tác phẩm NFT đã được thanh toán (${sale.priceSol ? `${sale.priceSol} SOL` : "90%"}) & ghi nhận quyền sở hữu on-chain trên ví của bạn.`,
            imageUrl: cachedImage,
            creator: sale.buyer,
            createdAt: sale.soldAt || Date.now(),
            category: "Đấu Giá Thắng Cuộc",
            rarity: art?.rarity || "collector",
          });
        }
      }
    }
  } catch {}
  return wonList;
}

export function getUserMintedArtworks(walletAddress: string): MintedArtworkRecord[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const walletNorm = walletAddress.toLowerCase().trim();
    const raw = window.localStorage.getItem(`${PORTFOLIO_PREFIX}${walletAddress}`);
    let list: MintedArtworkRecord[] = raw ? JSON.parse(raw) : [];

    // Filter out items that have been sold to someone else
    list = list.filter((x) => !isArtworkSoldBySeller(x.mintAddress, walletAddress));

    // Also include won/bought artworks for this wallet
    const won = getWonArtworksForBuyer(walletAddress);
    won.forEach((w) => {
      const idx = list.findIndex((x) => x.mintAddress.toLowerCase().trim() === w.mintAddress.toLowerCase().trim());
      if (idx >= 0) {
        list[idx] = w;
      } else {
        list.unshift(w);
      }
    });

    if (list.length > 0) return list;

    // Fallback to searching all items where creator matches
    const globalRaw = window.localStorage.getItem(`${PORTFOLIO_PREFIX}all`);
    if (globalRaw) {
      const all: MintedArtworkRecord[] = JSON.parse(globalRaw);
      const matched = all.filter((x) => x.creator.toLowerCase().trim() === walletNorm && !isArtworkSoldBySeller(x.mintAddress, walletAddress));
      return matched.length > 0 ? matched : won;
    }
    return won;
  } catch {
    return [];
  }
}

export function getArtworkByMint(mintAddress: string): MintedArtworkRecord | null {
  if (typeof window === "undefined" || !mintAddress) return null;
  // Known default artworks
  if (mintAddress.includes("5YN88qR8W8vNojBUHLhBu3dUsE7iQKfWeWPaEWTgyJZM")) {
    return {
      mintAddress: "5YN88qR8W8vNojBUHLhBu3dUsE7iQKfWeWPaEWTgyJZM",
      title: "CatMun",
      description: "Mèo Mun với họa tiết đơn giản",
      imageUrl: getArtworkImage("5YN88qR8W8vNojBUHLhBu3dUsE7iQKfWeWPaEWTgyJZM") || "/assets/messi-symphony.svg",
      creator: "7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX",
      createdAt: Date.now() - 3600000,
      category: "1/1 Masterpiece",
      rarity: "collector",
    };
  }
  if (mintAddress.includes("AbBz2DnqkDBxNSatYfct3Mvyxq8f8fFWGPnS7Wtm8tVu")) {
    return {
      mintAddress: "AbBz2DnqkDBxNSatYfct3Mvyxq8f8fFWGPnS7Wtm8tVu",
      title: "RabbitsEatGrass",
      description: "Chân dung kỹ thuật số của một chú thỏ trắng mang phong cách thời trang đường phố độc đáo.",
      imageUrl: getArtworkImage("AbBz2DnqkDBxNSatYfct3Mvyxq8f8fFWGPnS7Wtm8tVu") || "/assets/messi-symphony.svg",
      creator: "7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX",
      createdAt: Date.now() - 7200000,
      category: "1/1 Masterpiece",
      rarity: "rare",
    };
  }
  try {
    const globalRaw = window.localStorage.getItem(`${PORTFOLIO_PREFIX}all`);
    if (globalRaw) {
      const all: MintedArtworkRecord[] = JSON.parse(globalRaw);
      const found = all.find((x) => x.mintAddress.toLowerCase() === mintAddress.toLowerCase());
      if (found) return found;
    }
  } catch {}
  return null;
}

const HIDDEN_PREFIX = "mintly:hidden:";

export function deleteMintedArtwork(mintAddress: string, walletAddress: string) {
  if (typeof window === "undefined") return;
  try {
    // 1. Remove from wallet portfolio list
    const walletKey = `${PORTFOLIO_PREFIX}${walletAddress}`;
    const existingRaw = window.localStorage.getItem(walletKey);
    if (existingRaw) {
      const list: MintedArtworkRecord[] = JSON.parse(existingRaw);
      const filtered = list.filter((x) => x.mintAddress !== mintAddress);
      window.localStorage.setItem(walletKey, JSON.stringify(filtered));
    }

    // 2. Mark as hidden for this specific wallet
    const hiddenKey = `${HIDDEN_PREFIX}${walletAddress}`;
    const hiddenRaw = window.localStorage.getItem(hiddenKey);
    const hiddenSet: string[] = hiddenRaw ? JSON.parse(hiddenRaw) : [];
    if (!hiddenSet.includes(mintAddress)) {
      hiddenSet.push(mintAddress);
      window.localStorage.setItem(hiddenKey, JSON.stringify(hiddenSet));
    }
  } catch (err) {
    console.warn("Failed to delete artwork:", err);
  }
}

export function getHiddenMints(walletAddress: string): string[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const raw = window.localStorage.getItem(`${HIDDEN_PREFIX}${walletAddress}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function unhideArtwork(mintAddress: string, walletAddress: string) {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    const hiddenKey = `${HIDDEN_PREFIX}${walletAddress}`;
    const hiddenRaw = window.localStorage.getItem(hiddenKey);
    if (hiddenRaw) {
      const hiddenSet: string[] = JSON.parse(hiddenRaw);
      const filtered = hiddenSet.filter((m) => m.toLowerCase() !== mintAddress.toLowerCase());
      window.localStorage.setItem(hiddenKey, JSON.stringify(filtered));
    }
  } catch {}
}

const SOLD_KEY = "mintly:sold_artworks";

export interface SoldArtworkRecord {
  mintAddress: string;
  seller: string;
  buyer: string;
  soldAt: number;
  auctionPda?: string;
  priceSol?: number;
}

export function markArtworkAsSold(record: SoldArtworkRecord) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SOLD_KEY);
    const list: SoldArtworkRecord[] = raw ? JSON.parse(raw) : [];
    
    // Unshift newest sale to the top
    list.unshift(record);
    window.localStorage.setItem(SOLD_KEY, JSON.stringify(list));

    // 1. Automatically delete & hide from seller's portfolio
    deleteMintedArtwork(record.mintAddress, record.seller);

    // 2. Automatically unhide & transfer into buyer's portfolio
    unhideArtwork(record.mintAddress, record.buyer);
    const art = getArtworkByMint(record.mintAddress);
    saveMintedArtwork({
      mintAddress: record.mintAddress,
      title: art?.title || `Tác phẩm #${record.mintAddress.slice(0, 4)}`,
      description: art?.description || `Tác phẩm NFT đã được thanh toán & ghi nhận quyền sở hữu on-chain trên ví của bạn.`,
      imageUrl: getArtworkImage(record.mintAddress) || art?.imageUrl || "/assets/messi-symphony.svg",
      creator: record.buyer,
      createdAt: record.soldAt || Date.now(),
      category: "Đấu Giá Thắng Cuộc",
      rarity: art?.rarity || "collector",
    });

    // 3. Update any active secondary auction record to SETTLED
    const secondaryRaw = window.localStorage.getItem(SECONDARY_AUCTION_KEY);
    if (secondaryRaw) {
      const sList: CustomAuctionRecord[] = JSON.parse(secondaryRaw);
      const sIdx = sList.findIndex(
        (x) =>
          x.nftMint.toLowerCase().trim() === record.mintAddress.toLowerCase().trim() ||
          (record.auctionPda && x.id.toLowerCase().trim() === record.auctionPda.toLowerCase().trim())
      );
      if (sIdx >= 0) {
        sList[sIdx].status = "SETTLED";
        window.localStorage.setItem(SECONDARY_AUCTION_KEY, JSON.stringify(sList));
      }
    }
  } catch (err) {
    console.warn("Failed to mark artwork as sold:", err);
  }
}

export function isArtworkSoldBySeller(mintAddress: string, walletAddress: string): boolean {
  if (typeof window === "undefined" || !mintAddress || !walletAddress) return false;
  try {
    const raw = window.localStorage.getItem(SOLD_KEY);
    if (!raw) return false;
    const list: SoldArtworkRecord[] = JSON.parse(raw);
    const walletNorm = walletAddress.toLowerCase().trim();
    const mintNorm = mintAddress.toLowerCase().trim();

    // Find the most recent sale for this mint
    const sorted = [...list]
      .filter((x) => x.mintAddress.toLowerCase().trim() === mintNorm)
      .sort((a, b) => (b.soldAt || 0) - (a.soldAt || 0));

    if (sorted.length === 0) return false;

    const latest = sorted[0];
    // If the latest buyer is this wallet, they currently OWN it (not sold by them)
    if (latest.buyer.toLowerCase().trim() === walletNorm) {
      return false;
    }
    // If this wallet was the seller in the latest sale, then they sold it
    if (latest.seller.toLowerCase().trim() === walletNorm) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const SECONDARY_AUCTION_KEY = "mintly:secondary_auctions";

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

export function saveSecondaryAuction(record: CustomAuctionRecord) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(SECONDARY_AUCTION_KEY);
    const list: CustomAuctionRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(
      (x) =>
        x.id.toLowerCase() === record.id.toLowerCase() ||
        x.nftMint.toLowerCase() === record.nftMint.toLowerCase()
    );
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    window.localStorage.setItem(SECONDARY_AUCTION_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to save secondary auction:", err);
  }
}

export function getSecondaryAuction(pdaOrMint: string): CustomAuctionRecord | null {
  if (typeof window === "undefined" || !pdaOrMint) return null;
  try {
    const raw = window.localStorage.getItem(SECONDARY_AUCTION_KEY);
    if (!raw) return null;
    const list: CustomAuctionRecord[] = JSON.parse(raw);
    const target = pdaOrMint.toLowerCase().trim();
    return (
      list.find(
        (x) =>
          x.id.toLowerCase().trim() === target ||
          x.nftMint.toLowerCase().trim() === target ||
          target.includes(x.id.toLowerCase().trim()) ||
          target.includes(x.nftMint.toLowerCase().trim()) ||
          x.id.toLowerCase().trim().includes(target) ||
          x.nftMint.toLowerCase().trim().includes(target)
      ) || null
    );
  } catch {
    return null;
  }
}

export function updateSecondaryAuctionBid(pdaOrMint: string, highestBidSol: number, highestBidder: string) {
  if (typeof window === "undefined" || !pdaOrMint) return;
  try {
    const raw = window.localStorage.getItem(SECONDARY_AUCTION_KEY);
    if (!raw) return;
    const list: CustomAuctionRecord[] = JSON.parse(raw);
    const target = pdaOrMint.toLowerCase().trim();
    const idx = list.findIndex(
      (x) =>
        x.id.toLowerCase().trim() === target ||
        x.nftMint.toLowerCase().trim() === target ||
        target.includes(x.id.toLowerCase().trim()) ||
        target.includes(x.nftMint.toLowerCase().trim())
    );
    if (idx >= 0) {
      list[idx].currentBid = highestBidSol.toFixed(2);
      window.localStorage.setItem(SECONDARY_AUCTION_KEY, JSON.stringify(list));
    }
  } catch {}
}

export function getAllSecondaryAuctions(): CustomAuctionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SECONDARY_AUCTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isAuctionSettled(auctionPdaOrMint: string, minTimestampMs: number = 0): boolean {
  if (typeof window === "undefined" || !auctionPdaOrMint) return false;
  const target = auctionPdaOrMint.toLowerCase().trim();

  // 1. Check secondary auctions (current round state takes precedence)
  const secondary = getSecondaryAuction(target);
  if (secondary) {
    return secondary.status?.toUpperCase() === "SETTLED";
  }

  // 2. Check sold records
  try {
    const raw = window.localStorage.getItem(SOLD_KEY);
    if (raw) {
      const list: SoldArtworkRecord[] = JSON.parse(raw);
      const isSold = list.some(
        (x) =>
          ((x.auctionPda && x.auctionPda.toLowerCase().trim() === target) ||
          x.mintAddress.toLowerCase().trim() === target ||
          (x.auctionPda && target.includes(x.auctionPda.toLowerCase().trim())) ||
          (x.mintAddress && target.includes(x.mintAddress.toLowerCase().trim()))) &&
          (minTimestampMs === 0 || (x.soldAt && x.soldAt >= minTimestampMs))
      );
      if (isSold) return true;
    }
  } catch {
    return false;
  }

  return false;
}
