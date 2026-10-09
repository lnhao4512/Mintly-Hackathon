import { createHash } from "node:crypto";
import siteData from "@/data/site-fingerprints.json";
import { saveFingerprint, getAllFingerprints, type ArtworkFingerprint } from "@/lib/db/fingerprints";
import {
  compareFeatures,
  cosine,
  embeddingScore,
  extractFeatures,
  normalizeEmbedding,
  type ImageFeatures,
} from "@/lib/fingerprint/features";

/**
 * Multi-signal duplicate / imitation detector, tuned for Vercel serverless:
 *  - perceptual hashes (pHash + dHash, mirror-aware) + luminance layout + colour histogram
 *    are computed here with sharp (small native binary, ~50ms per image);
 *  - the CLIP embedding is computed in the visitor's browser (transformers.js) and sent as a
 *    512-float vector, so no ML model has to fit in / cold-start inside the function;
 *  - the built-in catalogue is pre-indexed at build time (src/data/site-fingerprints.json).
 */

export type MatchType = "EXACT" | "NEAR_DUPLICATE" | "SEMANTIC" | "DISTINCT";

export interface SimilarityAnalysis {
  status: "LOW_SIMILARITY" | "HIGH_SIMILARITY" | "MODERATE_SIMILARITY";
  similarity: number; // 0.0 - 100.0
  originalityScore: number; // 0.0 - 100.0
  potentialDuplicate: boolean;
  matchType: MatchType;
  engine: string;
  visualSimilarity: number; // luminance layout
  colorSimilarity: number;
  semanticSimilarity: number; // CLIP embedding (0 when unavailable)
  hashSimilarity: number; // pHash + dHash
  embeddingAvailable: boolean;
  perceptualHash: string;
  dominantColors: string[];
  complexityScore: number; // 0 - 100
  totalDatabaseItemsCompared: number;
  /** set when another creator's exclusive work is at least as similar as the creator's chosen threshold */
  exclusiveConflict?: { title: string; mint?: string; similarity: number; threshold: number } | null;
  closestMatch: {
    title: string;
    similarity: number;
    category: string;
    mint?: string;
  } | null;
  similarItems: Array<{
    mint: string;
    similarity: number;
    title: string;
    reason: string;
  }>;
  evidence: Array<{ type: string; value: string }>;
  message: string;
  metadataAnalysis: string;
  provenanceAnalysis: string;
}

export interface AnalyzeInput {
  imageData: string; // data URL of the artwork (the browser sends a <=768px JPEG thumbnail)
  sha256?: string; // sha256 of the full-resolution export, computed in the browser
  embedding?: unknown; // CLIP image embedding computed in the browser
  metadata?: { name?: string; description?: string; mint?: string };
  locale?: "vi" | "en";
  /** wallet of the person minting; their own exclusive works never block them */
  creator?: string;
  /** registration only: protect this work against lookalikes */
  exclusive?: boolean;
  exclusiveThreshold?: number;
}

interface ReferenceItem extends Partial<ImageFeatures> {
  id: string;
  title: string;
  category: string;
  sha256?: string;
  embedding?: number[] | null;
  createdAt?: number;
  creator?: string;
  exclusive?: boolean;
  exclusiveThreshold?: number;
}

const SITE_ITEMS = (siteData as { items: ReferenceItem[] }).items;

const MINTED_CATEGORY = "NFT đã mint trên MINTLY";
const HIGH_THRESHOLD = 75;
const MODERATE_THRESHOLD = 40;
export const EXCLUSIVE_MIN = 40;
export const EXCLUSIVE_MAX = 95;
const clampThreshold = (v: unknown) => Math.min(EXCLUSIVE_MAX, Math.max(EXCLUSIVE_MIN, Math.round(Number(v)) || 70));

function decodeImage(imageData: string): Buffer {
  return Buffer.from(imageData.replace(/^data:[^;]+;base64,/, ""), "base64");
}

/**
 * Registers an artwork ONLY after it has been minted on-chain, persisted to MongoDB so the
 * provenance registry survives restarts/redeploys and is shared across all instances.
 */
export async function registerMintedArtwork(input: AnalyzeInput): Promise<boolean> {
  try {
    const buffer = decodeImage(input.imageData);
    const { flip: _flip, ...features } = await extractFeatures(buffer);
    const sha256 = input.sha256 || createHash("sha256").update(buffer).digest("hex");

    await saveFingerprint({
      fingerprint: sha256,
      title: input.metadata?.name || "",
      mint: input.metadata?.mint || "",
      creator: input.creator || undefined,
      exclusive: input.exclusive === true,
      exclusiveThreshold: input.exclusive ? clampThreshold(input.exclusiveThreshold) : undefined,
      ...features,
      embedding: normalizeEmbedding(input.embedding),
      createdAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error("Failed to register minted artwork:", err);
    return false;
  }
}

const pct = (n: number) => Number((n * 100).toFixed(1));

interface Scored {
  item: ReferenceItem;
  score: number; // 0..1 fused
  hash: number;
  struct: number;
  color: number;
  emb: number;
  cos: number;
  dist: number;
  mirrored: boolean;
  exact: boolean;
  matchType: MatchType;
}

/** Main analysis: compares against the built-in catalogue and every NFT minted on MINTLY. */
export async function analyzeArtwork(input: AnalyzeInput): Promise<SimilarityAnalysis> {
  const buffer = decodeImage(input.imageData);
  const sha256 = input.sha256 || createHash("sha256").update(buffer).digest("hex");
  const query = await extractFeatures(buffer);
  const queryEmbedding = normalizeEmbedding(input.embedding);

  const minted = await getAllFingerprints().catch((err) => {
    console.error("Failed to load minted fingerprints:", err);
    return [] as ArtworkFingerprint[];
  });

  const references: ReferenceItem[] = [
    ...SITE_ITEMS,
    // Legacy entries (pre perceptual-hash) carry no hashes and can only match by exact sha256
    ...minted.map((m) => ({
      ...m,
      id: m.mint || m.fingerprint,
      sha256: m.fingerprint,
      category: MINTED_CATEGORY,
    })),
  ];

  const scored: Scored[] = references.map((item) => {
    const exact = !!item.sha256 && item.sha256 === sha256;
    const hasFeatures = !!(item.phash && item.dhash && item.gray && item.hist);
    const f = hasFeatures
      ? compareFeatures(query, item as ImageFeatures)
      : { hashDistance: 64, hashScore: 0, structScore: 0, colorScore: 0, mirrored: false };

    const cos = queryEmbedding && item.embedding?.length ? cosine(queryEmbedding, item.embedding) : 0;
    const emb = queryEmbedding && item.embedding?.length ? embeddingScore(cos) : 0;

    // Fusion: any strong signal is enough on its own; weaker ones reinforce each other.
    // Without an embedding, layout+colour alone is capped (they are easily fooled by flat art).
    const blend = emb
      ? 0.7 * emb + 0.2 * f.structScore + 0.1 * f.colorScore
      : 0.85 * (0.7 * f.structScore + 0.3 * f.colorScore);
    const score = exact ? 1 : Math.max(f.hashScore, emb, blend);

    let matchType: MatchType = "DISTINCT";
    if (exact || (!f.mirrored && f.hashDistance <= 1.5)) matchType = "EXACT";
    else if (f.hashScore >= 0.6 || (f.hashDistance <= 8 && f.hashScore >= 0.4)) matchType = "NEAR_DUPLICATE";
    else if (score * 100 >= MODERATE_THRESHOLD) matchType = "SEMANTIC";

    return { item, score, hash: f.hashScore, struct: f.structScore, color: f.colorScore, emb, cos, dist: f.hashDistance, mirrored: f.mirrored, exact, matchType };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Exclusive works of OTHER creators: refuse anything at least as similar as the owner's chosen threshold.
  const conflict = scored.find(
    (s) => s.item.exclusive && (!input.creator || s.item.creator !== input.creator) && pct(s.score) >= clampThreshold(s.item.exclusiveThreshold)
  );

  const L = (vi: string, en: string) => (input.locale === "en" ? en : vi);
  const reasonFor = (s: Scored) => {
    if (s.exact) return L("Trùng khớp 100% dữ liệu tệp gốc.", "100% match with the original file data.");
    if (s.matchType === "EXACT") return L(`Ảnh gần như y hệt (khác ${s.dist} bit hash) — có thể chỉ đổi định dạng/kích thước.`, `Almost identical (${s.dist} hash bits differ) — possibly just a format or size change.`);
    if (s.matchType === "NEAR_DUPLICATE")
      return L(`Cùng một ảnh đã bị chỉnh sửa (resize / nén / lật / cắt / đổi màu)${s.mirrored ? " — phát hiện lật ngược" : ""} — khoảng cách hash ${s.dist}/64.`, `The same image, edited (resized / compressed / flipped / cropped / recoloured)${s.mirrored ? " — mirrored" : ""} — hash distance ${s.dist}/64.`);
    if (s.emb >= 0.4) return L(`AI nhận diện bố cục & phong cách tương tự (${pct(s.emb)}%).`, `AI detects a similar layout and style (${pct(s.emb)}%).`);
    return L(`Tương đồng ${pct(s.score)}% về ${s.color > s.struct ? "tông màu" : "bố cục thị giác"}.`, `${pct(s.score)}% similar in ${s.color > s.struct ? "colour palette" : "visual layout"}.`);
  };

  const similarItems = scored
    .filter((s) => s.score * 100 >= 15)
    .slice(0, 3)
    .map((s) => ({
      mint: s.item.id,
      similarity: pct(s.score),
      title: s.item.title,
      reason: reasonFor(s),
    }));

  const finalSimilarity = best ? Number(Math.min(99.9, Math.max(1, pct(best.score))).toFixed(1)) : 1;
  const originalityScore = Number((100 - finalSimilarity).toFixed(1));

  let status: SimilarityAnalysis["status"] = "LOW_SIMILARITY";
  if (finalSimilarity >= HIGH_THRESHOLD) status = "HIGH_SIMILARITY";
  else if (finalSimilarity >= MODERATE_THRESHOLD) status = "MODERATE_SIMILARITY";

  const matchType: MatchType = best && finalSimilarity >= MODERATE_THRESHOLD ? best.matchType : "DISTINCT";
  const closestTitle = best?.item.title ?? "";

  let message = L(`Tác phẩm độc bản: đã đối chiếu ${references.length} tác phẩm, tính nguyên bản ${originalityScore}%. Đạt chuẩn NFT 1/1.`, `Original work: compared with ${references.length} artworks, originality ${originalityScore}%. Meets the 1/1 NFT standard.`);
  if (status === "HIGH_SIMILARITY") {
    message =
      matchType === "SEMANTIC"
        ? L(`Cảnh báo: AI nhận thấy tác phẩm giống bố cục/phong cách "${closestTitle}" (${finalSimilarity}%). Có thể là bản nhái hoặc vẽ lại.`, `Warning: AI finds the layout/style similar to "${closestTitle}" (${finalSimilarity}%). It may be an imitation or a redraw.`)
        : L(`Cảnh báo: tác phẩm trùng hoặc là bản chỉnh sửa của "${closestTitle}" (${finalSimilarity}%).`, `Warning: the work duplicates or is an edit of "${closestTitle}" (${finalSimilarity}%).`);
  } else if (status === "MODERATE_SIMILARITY") {
    message = L(`Có nét tương đồng vừa phải (${finalSimilarity}%) với "${closestTitle}". Nên kiểm tra lại trước khi mint.`, `Moderate similarity (${finalSimilarity}%) with "${closestTitle}". Review before minting.`);
  }
  if (conflict) {
    message = L(`Không thể mint: tác phẩm giống ${pct(conflict.score)}% với "${conflict.item.title}", một tác phẩm độc quyền (chủ sở hữu chặn từ ${clampThreshold(conflict.item.exclusiveThreshold)}%).`, `Cannot mint: the work is ${pct(conflict.score)}% similar to "${conflict.item.title}", an exclusive artwork (its owner blocks from ${clampThreshold(conflict.item.exclusiveThreshold)}%).`);
  }
  if (!queryEmbedding) message += L(" (Chưa có phân tích AI embedding — kết quả chỉ dựa trên hash & màu sắc.)", " (No AI embedding analysis yet — result based on hash and colour only.)");

    return {
    status,
    similarity: finalSimilarity,
    originalityScore,
    potentialDuplicate: finalSimilarity >= HIGH_THRESHOLD,
    matchType,
    engine: queryEmbedding ? "phash+dhash+layout+color+clip" : "phash+dhash+layout+color",
    visualSimilarity: best ? pct(best.struct) : 0,
    colorSimilarity: best ? pct(best.color) : 0,
    semanticSimilarity: best ? pct(best.emb) : 0,
    hashSimilarity: best ? pct(best.hash) : 0,
    embeddingAvailable: !!queryEmbedding,
    perceptualHash: query.phash,
    dominantColors: query.dominantColors,
    complexityScore: query.complexity,
    totalDatabaseItemsCompared: references.length,
    closestMatch: best
      ? {
          title: best.item.title,
          similarity: finalSimilarity,
          category: best.item.category,
          mint: best.item.category === MINTED_CATEGORY ? best.item.id : undefined,
        }
      : null,
    exclusiveConflict: conflict
      ? { title: conflict.item.title, mint: conflict.item.id, similarity: pct(conflict.score), threshold: clampThreshold(conflict.item.exclusiveThreshold) }
      : null,
    similarItems,
    evidence: [
      { type: "artwork_sha256", value: sha256 },
      { type: "perceptual_hash", value: query.phash },
      { type: "difference_hash", value: query.dhash },
      ...(best ? [{ type: "closest_hash_distance", value: `${best.dist}/64 bit` }] : []),
      { type: "database_items_scanned", value: L(`${references.length} tác phẩm (catalogue + NFT đã mint)`, `${references.length} artworks (catalogue + minted NFTs)`) },
    ],
    message,
    metadataAnalysis: input.metadata?.name
      ? L(`Metadata hợp lệ cho "${input.metadata.name}".`, `Valid metadata for "${input.metadata.name}".`)
      : L("Metadata chưa đầy đủ tên tác phẩm.", "Metadata is missing the artwork title."),
    provenanceAnalysis:
      status === "HIGH_SIMILARITY"
        ? L("Không đảm bảo Độc bản 1/1 — tồn tại tác phẩm rất giống trong hệ thống.", "A 1/1 original is not guaranteed — a very similar artwork exists in the system.")
        : L("Fingerprint (SHA-256 + perceptual hash + AI embedding) sẵn sàng để ghi nhận quyền tác giả.", "Fingerprint (SHA-256 + perceptual hash + AI embedding) is ready to record authorship."),
  };
}
