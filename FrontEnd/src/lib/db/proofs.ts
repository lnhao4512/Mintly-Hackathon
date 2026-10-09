import { getDb } from "@/lib/mongodb";

export interface CreationProofRecord {
  mintAddress: string;
  creator: string;
  method: "drawn" | "imported";
  strokes: number;
  durationMs: number;
  frames: string[];
  proofHash: string;
  createdAt: number;
}

async function collection() {
  const db = await getDb();
  return db.collection<CreationProofRecord>("creation_proofs");
}

export async function saveProof(record: CreationProofRecord) {
  const col = await collection();
  await col.updateOne({ mintAddress: record.mintAddress }, { $set: record }, { upsert: true });
}

export async function getProof(mintAddress: string): Promise<CreationProofRecord | null> {
  const col = await collection();
  const doc = await col.findOne({ mintAddress });
  if (!doc) return null;
  const { _id, ...rest } = doc as typeof doc & { _id?: unknown };
  void _id;
  return rest;
}
