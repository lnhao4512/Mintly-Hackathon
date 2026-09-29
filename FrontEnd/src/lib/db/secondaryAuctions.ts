import { getDb } from "@/lib/mongodb";

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

async function collection() {
  const db = await getDb();
  return db.collection<CustomAuctionRecord>("secondary_auctions");
}

export async function upsertSecondaryAuction(record: CustomAuctionRecord) {
  const col = await collection();
  await col.updateOne(
    { $or: [{ id: record.id }, { nftMint: record.nftMint }] },
    { $set: record },
    { upsert: true }
  );
}

export async function findSecondaryAuction(pdaOrMint: string): Promise<CustomAuctionRecord | null> {
  const col = await collection();
  const target = escapeRegex(pdaOrMint.toLowerCase().trim());
  const doc = await col.findOne({
    $or: [
      { id: { $regex: target, $options: "i" } },
      { nftMint: { $regex: target, $options: "i" } },
    ],
  });
  return doc ? stripId(doc) : null;
}

export async function updateSecondaryAuctionBid(pdaOrMint: string, highestBidSol: number) {
  const col = await collection();
  const target = escapeRegex(pdaOrMint.toLowerCase().trim());
  await col.updateOne(
    {
      $or: [
        { id: { $regex: target, $options: "i" } },
        { nftMint: { $regex: target, $options: "i" } },
      ],
    },
    { $set: { currentBid: highestBidSol.toFixed(2) } }
  );
}

export async function getAllSecondaryAuctions(): Promise<CustomAuctionRecord[]> {
  const col = await collection();
  const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(stripId);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
