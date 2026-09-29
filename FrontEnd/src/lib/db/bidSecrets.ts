import { getDb } from "@/lib/mongodb";

export interface SavedBidSecret {
  auctionPda: string;
  bidder: string;
  bidAmountSol: number;
  bidAmountLamports: number;
  secret: string;
  commitmentHex: string;
  timestamp: number;
}

async function collection() {
  const db = await getDb();
  return db.collection<SavedBidSecret>("bid_secrets");
}

export async function saveBidSecret(item: SavedBidSecret) {
  const col = await collection();
  await col.updateOne(
    { auctionPda: item.auctionPda, bidder: item.bidder },
    { $set: item },
    { upsert: true }
  );
}

export async function getBidSecret(auctionPda: string, bidder: string): Promise<SavedBidSecret | null> {
  const col = await collection();
  const doc = await col.findOne({
    auctionPda: { $regex: `^${escapeRegex(auctionPda)}$`, $options: "i" },
    bidder: { $regex: `^${escapeRegex(bidder)}$`, $options: "i" },
  });
  return doc ? stripId(doc) : null;
}

export async function getBidsForAuction(auctionPda: string, minTimestampMs = 0): Promise<SavedBidSecret[]> {
  const col = await collection();
  const query: Record<string, unknown> = {
    auctionPda: { $regex: `^${escapeRegex(auctionPda)}$`, $options: "i" },
  };
  if (minTimestampMs > 0) {
    query.timestamp = { $gte: minTimestampMs };
  }
  const docs = await col.find(query).sort({ bidAmountSol: -1 }).toArray();
  return docs.map(stripId);
}

export async function getAllBidSecrets(): Promise<SavedBidSecret[]> {
  const col = await collection();
  const docs = await col.find({}).toArray();
  return docs.map(stripId);
}

export async function getBidsForBidder(bidder: string): Promise<SavedBidSecret[]> {
  const col = await collection();
  const docs = await col
    .find({ bidder: { $regex: `^${escapeRegex(bidder)}$`, $options: "i" } })
    .toArray();
  return docs.map(stripId);
}

export async function clearBidsForAuction(auctionPdaOrMint: string) {
  const col = await collection();
  const target = escapeRegex(auctionPdaOrMint.toLowerCase().trim());
  await col.deleteMany({ auctionPda: { $regex: target, $options: "i" } });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
