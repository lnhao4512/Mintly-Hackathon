import { getDb } from "@/lib/mongodb";

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

async function collection() {
  const db = await getDb();
  return db.collection<MintedArtworkRecord>("artworks");
}

export async function upsertArtwork(record: MintedArtworkRecord) {
  const col = await collection();
  await col.updateOne(
    { mintAddress: record.mintAddress },
    { $set: record },
    { upsert: true }
  );
}

export async function getArtworksByCreator(creator: string): Promise<MintedArtworkRecord[]> {
  const col = await collection();
  const walletNorm = creator.toLowerCase().trim();
  const docs = await col
    .find({ creator: { $regex: `^${walletNorm}$`, $options: "i" } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map(stripId);
}

export async function getArtworkByMint(mintAddress: string): Promise<MintedArtworkRecord | null> {
  const col = await collection();
  const doc = await col.findOne({ mintAddress: { $regex: `^${escapeRegex(mintAddress)}$`, $options: "i" } });
  return doc ? stripId(doc) : null;
}

export async function deleteArtworkForWallet(mintAddress: string, walletAddress: string): Promise<number> {
  const col = await collection();
  const res = await col.deleteOne({
    mintAddress: { $regex: `^${escapeRegex(mintAddress)}$`, $options: "i" },
    creator: { $regex: `^${escapeRegex(walletAddress)}$`, $options: "i" },
  });
  return res.deletedCount;
}

/**
 * An NFT stays in the wallet after "delete" (we cannot burn it), so the portfolio would re-discover it from
 * the wallet's token accounts on the next load. Deleted mints are therefore remembered per wallet.
 */
async function hiddenCollection() {
  const db = await getDb();
  return db.collection<{ wallet: string; mintAddress: string; hiddenAt: number }>("hidden_artworks");
}

export async function hideArtworkForWallet(mintAddress: string, walletAddress: string) {
  const col = await hiddenCollection();
  await col.updateOne({ wallet: walletAddress, mintAddress }, { $set: { hiddenAt: Date.now() } }, { upsert: true });
}

export async function unhideArtworkForWallet(mintAddress: string, walletAddress: string) {
  const col = await hiddenCollection();
  await col.deleteOne({ wallet: walletAddress, mintAddress });
}

export async function getHiddenMintsForWallet(walletAddress: string): Promise<string[]> {
  const col = await hiddenCollection();
  return (await col.find({ wallet: walletAddress }).toArray()).map((d) => d.mintAddress);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
