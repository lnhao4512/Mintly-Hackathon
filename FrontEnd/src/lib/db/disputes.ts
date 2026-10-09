import { getDb } from "@/lib/mongodb";

export interface DisputeRecord {
  id: string;
  mintAddress: string;
  reporter: string;
  reason: string;
  evidenceUrl?: string;
  status: "open" | "upheld" | "rejected";
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  /** Reward owed to the reporter when upheld. Tracked as a ledger entry; paid out manually by the admin (not on-chain yet). */
  bountySol?: number;
  bountyPaid?: boolean;
}

export const BOUNTY_SOL = 0.05;

async function collection() {
  const db = await getDb();
  return db.collection<DisputeRecord>("disputes");
}

function strip(doc: DisputeRecord & { _id?: unknown }): DisputeRecord {
  const { _id, ...rest } = doc;
  void _id;
  return rest;
}

export async function createDispute(d: Omit<DisputeRecord, "id" | "status" | "createdAt">): Promise<DisputeRecord> {
  const col = await collection();
  const record: DisputeRecord = { ...d, id: crypto.randomUUID(), status: "open", createdAt: Date.now() };
  // one open report per reporter per artwork
  const exists = await col.findOne({ mintAddress: d.mintAddress, reporter: d.reporter, status: "open" });
  if (exists) return strip(exists);
  await col.insertOne({ ...record });
  return record;
}

export async function listDisputes(filter: { mintAddress?: string; status?: DisputeRecord["status"] }): Promise<DisputeRecord[]> {
  const col = await collection();
  const q: Record<string, unknown> = {};
  if (filter.mintAddress) q.mintAddress = filter.mintAddress;
  if (filter.status) q.status = filter.status;
  const docs = await col.find(q).sort({ createdAt: -1 }).limit(100).toArray();
  return docs.map(strip);
}

export async function resolveDispute(id: string, status: "upheld" | "rejected", resolvedBy: string): Promise<boolean> {
  const col = await collection();
  const res = await col.updateOne({ id, status: "open" }, { $set: { status, resolvedAt: Date.now(), resolvedBy, ...(status === "upheld" ? { bountySol: BOUNTY_SOL, bountyPaid: false } : {}) } });
  return res.modifiedCount === 1;
}
