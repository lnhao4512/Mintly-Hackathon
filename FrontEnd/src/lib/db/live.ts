import { getDb } from "@/lib/mongodb";

export interface LiveSession {
  sessionId: string;
  creator: string;
  title: string;
  frame: string; // latest canvas frame (data URL)
  startedAt: number;
  updatedAt: number;
  ended?: boolean;
}

const LIVE_WINDOW_MS = 20_000;

async function collection() {
  const db = await getDb();
  return db.collection<LiveSession>("live_sessions");
}

function publicView(d: LiveSession & { _id?: unknown }) {
  // never expose sessionId (it is the write token)
  const { _id, sessionId, ...rest } = d;
  void _id;
  void sessionId;
  return rest;
}

export async function startSession(s: Omit<LiveSession, "updatedAt" | "startedAt" | "frame">) {
  const col = await collection();
  const now = Date.now();
  await col.updateOne(
    { creator: s.creator },
    { $set: { ...s, frame: "", startedAt: now, updatedAt: now, ended: false } },
    { upsert: true }
  );
}

export async function pushFrame(sessionId: string, frame: string, title?: string): Promise<boolean> {
  const col = await collection();
  const set: Partial<LiveSession> = { frame, updatedAt: Date.now() };
  if (title) set.title = title;
  const res = await col.updateOne({ sessionId, ended: { $ne: true } }, { $set: set });
  return res.matchedCount === 1;
}

export async function endSession(sessionId: string) {
  const col = await collection();
  await col.updateOne({ sessionId }, { $set: { ended: true, updatedAt: Date.now() } });
}

export async function listLive() {
  const col = await collection();
  const docs = await col
    .find({ ended: { $ne: true }, updatedAt: { $gte: Date.now() - LIVE_WINDOW_MS } })
    .sort({ updatedAt: -1 })
    .limit(30)
    .project<LiveSession>({ frame: 0 })
    .toArray();
  return docs.map(publicView);
}

export async function getLive(creator: string) {
  const col = await collection();
  const d = await col.findOne({ creator });
  if (!d) return null;
  return { ...publicView(d), live: !d.ended && d.updatedAt >= Date.now() - LIVE_WINDOW_MS };
}
