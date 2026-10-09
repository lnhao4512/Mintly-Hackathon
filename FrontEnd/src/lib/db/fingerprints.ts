import { getDb } from "@/lib/mongodb";
import type { ImageFeatures } from "@/lib/fingerprint/features";

export interface ArtworkFingerprint extends Partial<ImageFeatures> {
  fingerprint: string; // sha256 of the exported artwork, unique key
  title: string;
  mint?: string;
  creator?: string;
  /** L2-normalised CLIP embedding (512-d); absent when the browser could not run the model */
  embedding?: number[] | null;
  /** Legacy 16-d byte-sample vector (pre-perceptual-hash registry entries) */
  vector?: number[];
  /** the creator asked to block other people's lookalikes of this work */
  exclusive?: boolean;
  /** similarity % (40-95) from which a lookalike by another creator is refused */
  exclusiveThreshold?: number;
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
