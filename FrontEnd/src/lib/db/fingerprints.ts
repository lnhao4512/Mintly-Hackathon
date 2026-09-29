import { getDb } from "@/lib/mongodb";

export interface ArtworkFingerprint {
  fingerprint: string; // sha256, unique key
  title: string;
  mint?: string;
  vector: number[];
  dominantColors: string[];
  createdAt: number;
}

async function collection() {
  const db = await getDb();
  return db.collection<ArtworkFingerprint>("artwork_fingerprints");
}

export async function saveFingerprint(item: ArtworkFingerprint) {
  const col = await collection();
  await col.updateOne(
    { fingerprint: item.fingerprint },
    { $set: item },
    { upsert: true }
  );
}

export async function findFingerprint(fingerprint: string): Promise<ArtworkFingerprint | null> {
  const col = await collection();
  const doc = await col.findOne({ fingerprint });
  return doc ? stripId(doc) : null;
}

export async function getAllFingerprints(): Promise<ArtworkFingerprint[]> {
  const col = await collection();
  const docs = await col.find({}).toArray();
  return docs.map(stripId);
}

function stripId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc;
  return rest;
}
