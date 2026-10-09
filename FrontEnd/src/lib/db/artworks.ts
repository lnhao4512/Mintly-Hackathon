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

export async function deleteArtworkForWallet(mintAddress: string, walletAddress: string) {
  const col = await collection();
  await col.deleteOne({
    mintAddress: { $regex: `^${escapeRegex(mintAddress)}$`, $options: "i" },
    creator: { $regex: `^${escapeRegex(walletAddress)}$`, $options: "i" },
  });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
