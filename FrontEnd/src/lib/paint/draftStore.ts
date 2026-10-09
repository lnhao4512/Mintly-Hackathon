/** Studio drafts live in IndexedDB (layers as PNG data URLs are too big for localStorage). */

export interface DraftLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blend: string;
  png: string;
}

export interface DraftPayload {
  version: 1;
  updatedAt: number;
  title: string;
  statement: string;
  activeLayerId: string;
  layers: DraftLayer[];
  trace: { frames: string[]; strokes: number; startedAt: number; imported: boolean; elapsedMs: number };
  /** tiny preview for the restore dialog */
  thumb: string;
}

const DB_NAME = "mintly-studio";
const STORE = "drafts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const draftKey = (wallet?: string | null) => `draft:${wallet || "anonymous"}`;

export async function saveDraft(key: string, payload: DraftPayload): Promise<void> {
  await run("readwrite", (s) => s.put(payload, key));
}

export async function loadDraft(key: string): Promise<DraftPayload | null> {
  try {
    const v = await run<DraftPayload | undefined>("readonly", (s) => s.get(key) as IDBRequest<DraftPayload | undefined>);
    return v && v.version === 1 ? v : null;
  } catch {
    return null;
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(key));
  } catch {
    // ignore
  }
}
