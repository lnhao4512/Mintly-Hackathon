import { computeClipEmbedding } from "@/lib/fingerprint/embedding.client";
import { currentLocale } from "@/lib/i18n";

export interface ArtworkSimilarityResult {
  status: "LOW_SIMILARITY" | "HIGH_SIMILARITY" | "MODERATE_SIMILARITY" | "PENDING_PROVIDER" | "UNAVAILABLE";
  similarity: number | null;
  originalityScore?: number | null;
  potentialDuplicate: boolean | null;
  matchType?: "EXACT" | "NEAR_DUPLICATE" | "SEMANTIC" | "DISTINCT";
  exclusiveConflict?: { title: string; mint?: string; similarity: number; threshold: number } | null;
  engine?: string;
  hashSimilarity?: number | null;
  visualSimilarity?: number | null;
  colorSimilarity?: number | null;
  semanticSimilarity?: number | null;
  embeddingAvailable?: boolean;
  perceptualHash?: string;
  dominantColors?: string[];
  complexityScore?: number | null;
  closestMatch?: {
    title: string;
    similarity: number;
    category?: string;
    mint?: string;
  } | null;
  similarItems: Array<{ mint: string; similarity: number; title?: string; reason?: string }>;
  metadataAnalysis: string | null;
  provenanceAnalysis: string | null;
  potentialAnomalies?: string[];
  evidence: Array<{ type: string; value: string }>;
  message: string;
}

export type AiStage = "preparing" | "loading-model" | "embedding" | "comparing";

const THUMB_MAX = 768;

interface PreparedArtwork {
  imageData: string; // downscaled JPEG data URL (keeps the request well under Vercel's 4.5MB body limit)
  sha256: string;
  embedding: number[] | null;
}

let lastPrepared: { source: string; result: PreparedArtwork } | null = null;

async function sha256Hex(dataUrl: string): Promise<string> {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Cannot decode artwork image"));
    img.src = src;
  });
}

async function prepareArtwork(imageData: string, onStage?: (s: AiStage) => void): Promise<PreparedArtwork> {
  if (lastPrepared?.source === imageData) return lastPrepared.result;

  onStage?.("preparing");
  const img = await loadImage(imageData);
  const scale = Math.min(1, THUMB_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // The model input is centre-cropped to a lossless 224x224 here, so the browser and the
  // Node build script (which indexes the catalogue) feed CLIP near-identical pixels.
  const side = Math.min(canvas.width, canvas.height);
  const modelCanvas = document.createElement("canvas");
  modelCanvas.width = modelCanvas.height = 224;
  const mctx = modelCanvas.getContext("2d");
  if (!mctx) throw new Error("Canvas unavailable");
  mctx.imageSmoothingQuality = "high";
  mctx.drawImage(canvas, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side, 0, 0, 224, 224);
  const blob = await new Promise<Blob>((resolve, reject) =>
    modelCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Model input export failed"))), "image/png")
  );
  const thumbUrl = canvas.toDataURL("image/jpeg", 0.9);

  const [sha256, embedding] = await Promise.all([
    sha256Hex(imageData),
    computeClipEmbedding(blob, (info) => {
      if (info.status === "progress" || info.status === "download" || info.status === "initiate") {
        onStage?.("loading-model");
      } else if (info.status === "ready") {
        onStage?.("embedding");
      }
    }),
  ]);

  const result = { imageData: thumbUrl, sha256, embedding };
  lastPrepared = { source: imageData, result };
  return result;
}

export async function analyzeArtworkSimilarity(
  imageData: string,
  metadata: { name?: string; description?: string },
  onStage?: (s: AiStage) => void,
  creator?: string
): Promise<ArtworkSimilarityResult> {
  const prepared = await prepareArtwork(imageData, onStage);
  onStage?.("comparing");

  const response = await fetch("/api/ai/similarity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "analyze", ...prepared, metadata, creator, locale: currentLocale() }),
  });

  if (!response.ok) {
    throw new Error(`AI similarity request failed with status ${response.status}`);
  }

  return response.json() as Promise<ArtworkSimilarityResult>;
}

export async function registerMintedArtworkAI(
  imageData: string,
  metadata: { name?: string; description?: string; mint?: string },
  protection?: { creator?: string; exclusive?: boolean; exclusiveThreshold?: number }
): Promise<boolean> {
  try {
    const prepared = await prepareArtwork(imageData);
    const response = await fetch("/api/ai/similarity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "register", ...prepared, metadata, ...protection }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
