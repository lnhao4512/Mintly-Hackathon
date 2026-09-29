// Server-side perceptual feature extraction + similarity math.
// Self-contained (only depends on sharp) so build scripts can import it with
// `node --experimental-strip-types`.
import sharp, { type Sharp } from "sharp";

export interface ImageFeatures {
  phash: string; // 64-bit DCT perceptual hash (16 hex chars)
  dhash: string; // 64-bit gradient hash (16 hex chars)
  gray: string; // base64 of 16x16 grayscale thumbnail (256 bytes)
  hist: string; // base64 of 64-bin RGB histogram (4x4x4), scaled 0..255
  dominantColors: string[];
  complexity: number; // 0..100
  /** Hashes of 5x75% + 1x55% sub-regions: lets a cropped copy match the full original */
  crops?: HashPair[];
}

export interface HashPair {
  phash: string;
  dhash: string;
}

export interface QueryFeatures extends ImageFeatures {
  /** Same descriptors computed on the horizontally mirrored image */
  flip: Pick<ImageFeatures, "phash" | "dhash" | "gray">;
  /** Centre 75% of the query: lets a padded/bordered copy match the original */
  centerCrop: HashPair;
}

// ---------------------------------------------------------------- extraction

const DCT_SIZE = 32;
const DCT_COS: number[][] = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: DCT_SIZE }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / (2 * DCT_SIZE)))
);

function bitsToHex(bits: number[]): string {
  let out = "";
  for (let i = 0; i < bits.length; i += 4) {
    out += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
  }
  return out;
}

function phashFromGray32(px: Buffer): string {
  // Separable 2D DCT, keeping only the 8x8 low-frequency block.
  const rows: number[][] = Array.from({ length: DCT_SIZE }, () => new Array(8).fill(0));
  for (let y = 0; y < DCT_SIZE; y++) {
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let x = 0; x < DCT_SIZE; x++) s += px[y * DCT_SIZE + x] * DCT_COS[u][x];
      rows[y][u] = s;
    }
  }
  const coeffs: number[] = [];
  for (let v = 0; v < 8; v++) {
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let y = 0; y < DCT_SIZE; y++) s += rows[y][u] * DCT_COS[v][y];
      coeffs.push(s);
    }
  }
  const sorted = coeffs.slice(1).sort((a, b) => a - b); // ignore DC term
  const median = (sorted[30] + sorted[31]) / 2;
  return bitsToHex(coeffs.map((c) => (c > median ? 1 : 0)));
}

function dhashFromGray9x8(px: Buffer): string {
  const bits: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits.push(px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0);
  }
  return bitsToHex(bits);
}

async function grayRaw(base: Sharp, w: number, h: number, flip: boolean): Promise<Buffer> {
  let p = base.clone();
  if (flip) p = p.flop();
  return p.resize(w, h, { fit: "fill", kernel: "lanczos3" }).greyscale().raw().toBuffer();
}

function quantHex(v: number): string {
  return Math.min(255, v).toString(16).padStart(2, "0");
}

async function hashPair(p: Sharp): Promise<HashPair> {
  const [g32, g9] = await Promise.all([grayRaw(p, 32, 32, false), grayRaw(p, 9, 8, false)]);
  return { phash: phashFromGray32(g32), dhash: dhashFromGray9x8(g9) };
}

const CROP_RECTS: Array<[number, number, number]> = [
  // [left fraction, top fraction, size fraction]
  [0.125, 0.125, 0.75], // centre 75%
  [0, 0, 0.75],
  [0.25, 0, 0.75],
  [0, 0.25, 0.75],
  [0.25, 0.25, 0.75],
  [0.225, 0.225, 0.55], // centre 55%
];

export async function extractFeatures(input: Buffer): Promise<QueryFeatures> {
  // Decode once at a fixed working size (flatten transparency onto white to match the canvas
  // export) so every descriptor derives from the same pixels regardless of upload resolution.
  const { data, info } = await sharp(input, { failOn: "none", limitInputPixels: 64_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize(512, 512, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const base = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });

  const crops = await Promise.all(
    CROP_RECTS.map(([l, t, size]) => {
      const left = Math.floor(info.width * l);
      const top = Math.floor(info.height * t);
      return hashPair(
        base.clone().extract({
          left,
          top,
          width: Math.max(8, Math.min(info.width - left, Math.round(info.width * size))),
          height: Math.max(8, Math.min(info.height - top, Math.round(info.height * size))),
        })
      );
    })
  );

  const [g32, g9, g16, g32f, g9f, g16f, rgb] = await Promise.all([
    grayRaw(base, 32, 32, false),
    grayRaw(base, 9, 8, false),
    grayRaw(base, 16, 16, false),
    grayRaw(base, 32, 32, true),
    grayRaw(base, 9, 8, true),
    grayRaw(base, 16, 16, true),
    base.clone().resize(32, 32, { fit: "fill" }).raw().toBuffer(),
  ]);

  // Colour histogram (4x4x4) + fine palette (8x8x8) from the 32x32 RGB sample
  const hist = new Array(64).fill(0);
  const fine: Record<number, number> = {};
  const pixels = rgb.length / 3;
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i], g = rgb[i + 1], b = rgb[i + 2];
    hist[((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6)]++;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    fine[key] = (fine[key] || 0) + 1;
  }
  const histBytes = Buffer.from(hist.map((c) => Math.round((c / pixels) * 255)));
  const dominantColors = Object.entries(fine)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => {
      const n = Number(k);
      return `#${quantHex(((n >> 6) & 7) * 32 + 16)}${quantHex(((n >> 3) & 7) * 32 + 16)}${quantHex((n & 7) * 32 + 16)}`;
    });

  // Complexity = mean local gradient magnitude on the 32x32 luminance map
  let grad = 0;
  for (let y = 0; y < 31; y++) {
    for (let x = 0; x < 31; x++) {
      const i = y * 32 + x;
      grad += Math.abs(g32[i] - g32[i + 1]) + Math.abs(g32[i] - g32[i + 32]);
    }
  }
  const complexity = Math.max(0, Math.min(100, Math.round((grad / (31 * 31 * 2)) * 4)));

  return {
    phash: phashFromGray32(g32),
    dhash: dhashFromGray9x8(g9),
    gray: g16.toString("base64"),
    hist: histBytes.toString("base64"),
    dominantColors,
    complexity,
    crops,
    centerCrop: crops[0],
    flip: {
      phash: phashFromGray32(g32f),
      dhash: dhashFromGray9x8(g9f),
      gray: g16f.toString("base64"),
    },
  };
}

// ------------------------------------------------------------------- scoring

const POP = Array.from({ length: 16 }, (_, n) => n.toString(2).replace(/0/g, "").length);

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

function pearson(a: Buffer, b: Buffer): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let dot = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    dot += x * y; va += x * x; vb += y * y;
  }
  if (va === 0 || vb === 0) return va === vb && Math.abs(ma - mb) < 8 ? 1 : 0;
  return dot / Math.sqrt(va * vb);
}

export interface FeatureSimilarity {
  hashDistance: number;
  hashScore: number; // 0..1 — survives resize / recompression / colour shifts / mirroring
  structScore: number; // 0..1 — luminance layout correlation
  colorScore: number; // 0..1 — colour histogram intersection
  mirrored: boolean;
}

export function compareFeatures(q: QueryFeatures, s: ImageFeatures): FeatureSimilarity {
  const dDirect = (hamming(q.phash, s.phash) + hamming(q.dhash, s.dhash)) / 2;
  const dFlip = (hamming(q.flip.phash, s.phash) + hamming(q.flip.dhash, s.dhash)) / 2;
  const mirrored = dFlip < dDirect;
  const pairDist = (a: HashPair, b: HashPair) => (hamming(a.phash, b.phash) + hamming(a.dhash, b.dhash)) / 2;
  // Cropped / padded copies: small penalty so they never read as a byte-identical match
  const CROP_PENALTY = 2;
  const cropDist = Math.min(
    ...(s.crops ?? []).map((c) => pairDist(q, c) + CROP_PENALTY),
    pairDist(q.centerCrop, s) + CROP_PENALTY
  );
  const hashDistance = Math.min(dDirect, dFlip, cropDist);
  // 0 bits -> 1.0, 6 bits -> ~0.78, 12 bits -> ~0.37, 20+ bits -> ~0
  const hashScore = Math.exp(-((hashDistance / 12) ** 2));

  const sg = Buffer.from(s.gray, "base64");
  const corr = Math.max(pearson(Buffer.from(q.gray, "base64"), sg), pearson(Buffer.from(q.flip.gray, "base64"), sg));
  const structScore = Math.max(0, Math.min(1, (corr - 0.6) / 0.4));

  const qh = Buffer.from(q.hist, "base64");
  const sh = Buffer.from(s.hist, "base64");
  let inter = 0, sumQ = 0, sumS = 0;
  for (let i = 0; i < 64; i++) { inter += Math.min(qh[i], sh[i]); sumQ += qh[i]; sumS += sh[i]; }
  const colorScore = sumQ && sumS ? inter / Math.max(sumQ, sumS) : 0;

  return { hashDistance, hashScore, structScore, colorScore, mirrored };
}

export const EMBEDDING_DIM = 512;

export function normalizeEmbedding(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== EMBEDDING_DIM) return null;
  let norm = 0;
  for (const x of v) {
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    norm += x * x;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return null;
  return v.map((x: number) => Math.round((x / norm) * 1e4) / 1e4);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // both L2-normalised
}

/** CLIP image-to-image cosine -> 0..1 (0.78 ~ unrelated art, 0.97 ~ same picture) */
export function embeddingScore(cos: number): number {
  return Math.max(0, Math.min(1, (cos - 0.78) / 0.19));
}
