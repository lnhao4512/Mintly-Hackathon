import { getDb } from "@/lib/mongodb";

export interface SoldArtworkRecord {
  mintAddress: string;
  seller: string;
  buyer: string;
  soldAt: number;
  auctionPda?: string;
  priceSol?: number;
}

async function collection() {
  const db = await getDb();
  return db.collection<SoldArtworkRecord>("sales");
}

export async function recordSale(record: SoldArtworkRecord) {
  const col = await collection();
  await col.insertOne(record);
}

export async function getAllSales(): Promise<SoldArtworkRecord[]> {
  const col = await collection();
  const docs = await col.find({}).sort({ soldAt: -1 }).limit(200).toArray();
  return docs.map(stripId);
}

export async function getSalesForWallet(wallet: string): Promise<SoldArtworkRecord[]> {
  const col = await collection();
  const norm = wallet.toLowerCase().trim();
  const docs = await col
    .find({
      $or: [
        { buyer: { $regex: `^${escapeRegex(norm)}$`, $options: "i" } },
        { seller: { $regex: `^${escapeRegex(norm)}$`, $options: "i" } },
      ],
    })
    .sort({ soldAt: -1 })
    .toArray();
  return docs.map(stripId);
}

export async function getSalesForMint(mintAddress: string): Promise<SoldArtworkRecord[]> {
  const col = await collection();
  const docs = await col
    .find({ mintAddress: { $regex: `^${escapeRegex(mintAddress)}$`, $options: "i" } })
    .sort({ soldAt: 1 })
    .toArray();
  return docs.map(stripId);
}

export async function getLatestSaleForMint(mintAddress: string): Promise<SoldArtworkRecord | null> {
  const col = await collection();
  const doc = await col
    .find({ mintAddress: { $regex: `^${escapeRegex(mintAddress)}$`, $options: "i" } })
    .sort({ soldAt: -1 })
    .limit(1)
    .next();
  return doc ? stripId(doc) : null;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
