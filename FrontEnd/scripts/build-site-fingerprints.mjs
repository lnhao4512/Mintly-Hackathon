// Pre-computes perceptual hashes + CLIP embeddings for the artworks shipped in public/assets,
// so the Vercel function never has to read image files or run a model at request time.
//
//   npm run fingerprints
//
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage } from "@huggingface/transformers";
import { extractFeatures, normalizeEmbedding, compareFeatures, cosine, embeddingScore } from "../src/lib/fingerprint/features.ts";

const MODEL_ID = "Xenova/clip-vit-base-patch32";
const ASSETS = path.join(process.cwd(), "public", "assets");
const OUT = path.join(process.cwd(), "src", "data", "site-fingerprints.json");

const ARTWORKS = [
  ["messi-symphony.svg", "Messi: Symphony of Gold", "Huyền thoại bóng đá / Football Legend"],
  ["ronaldo-legacy.svg", "Ronaldo: Dynasty Legacy", "Huyền thoại bóng đá / Football Legend"],
  ["vietnam-rising.svg", "Vietnam Rising: Golden Star", "Tự hào dân tộc / National Pride"],
  ["emerald-dash.svg", "Emerald Dash: 90th Minute", "Khoảnh khắc sân cỏ / Match Moment"],
  ["final-whistle.svg", "Final Whistle Drama", "Khoảnh khắc sân cỏ / Match Moment"],
  ["night-press.svg", "Night Press", "Chiến thuật / Tactical Edition"],
  ["midfield-rhythm.svg", "Midfield Rhythm", "Nghệ thuật sân cỏ / Pitch Art"],
  ["pulse-derby.svg", "Pulse Derby", "Trận cầu rực lửa / Derby Match"],
  ["stadium-echo.svg", "Stadium Echo", "Khán đài / Stadium Atmosphere"],
  ["digital-renaissance.png", "Digital Renaissance", "Kỹ thuật số / Cyber Art"],
  ["synthetic-bloom.png", "Synthetic Bloom", "Nghệ thuật đương đại / Contemporary Neon"],
  ["concrete-solitude.png", "Concrete Solitude", "Đơn sắc / Urban Monochrome"],
  ["silent-epoch.png", "Silent Epoch", "Không gian / Surrealist Space"],
  ["void-geometry.png", "Void Geometry", "Hình học trừu tượng / Abstract Geometry"],
  ["hero-artwork.png", "MINTLY Genesis: Master Edition", "Phiên bản Master / Genesis"],
  ["demo-lunar-bloom.svg", "Lunar Bloom", "Bộ sưu tập thử nghiệm / Demo Collection"],
  ["demo-neon-orbit.svg", "Neon Orbit", "Quỹ đạo Neon / Orbit Series"],
  ["demo-pulse-canyon.svg", "Pulse Canyon", "Hẻm núi ánh sáng / Canyon Pulse"],
];

const processor = await AutoProcessor.from_pretrained(MODEL_ID);
const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: "q8" });

const items = [];
for (const [filename, title, category] of ARTWORKS) {
  const file = path.join(ASSETS, filename);
  if (!fs.existsSync(file)) {
    console.warn("skip (missing):", filename);
    continue;
  }
  const original = fs.readFileSync(file);
  // Rasterise exactly like the browser pipeline will (<=768px JPEG on white).
  const jpeg = await sharp(original, { density: 144 })
    .flatten({ background: "#ffffff" })
    .resize(768, 768, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 90 })
    .toBuffer();
  const features = await extractFeatures(jpeg);
  const { flip: _flip, ...stored } = features;
  // Same model input as the browser: centre-cropped lossless 224x224 taken from the 768px thumbnail.
  const modelInput = await sharp(jpeg).resize(224, 224, { fit: "cover", position: "centre" }).png().toBuffer();
  const img = await RawImage.fromBlob(new Blob([modelInput], { type: "image/png" }));
  const { image_embeds } = await model(await processor(img));
  const embedding = normalizeEmbedding(Array.from(image_embeds.data));

  items.push({
    id: filename,
    filename,
    title,
    category,
    sha256: createHash("sha256").update(original).digest("hex"),
    ...stored,
    embedding,
  });
  console.log("indexed", filename, stored.phash);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ model: MODEL_ID, generatedAt: new Date().toISOString(), items }));
console.log(`\nWrote ${items.length} fingerprints -> ${path.relative(process.cwd(), OUT)}`);

// Calibration report: how similar are the catalog items to each other?
const rows = [];
for (let i = 0; i < items.length; i++) {
  const q = await extractFeatures(await sharp(path.join(ASSETS, items[i].filename), { density: 144 }).flatten({ background: "#fff" }).resize(768, 768, { fit: "inside" }).jpeg({ quality: 90 }).toBuffer());
  for (let j = 0; j < items.length; j++) {
    if (i === j) continue;
    const s = compareFeatures(q, items[j]);
    const cos = cosine(items[i].embedding, items[j].embedding);
    rows.push({ a: items[i].id, b: items[j].id, hashDist: s.hashDistance, struct: +s.structScore.toFixed(2), emb: +embeddingScore(cos).toFixed(2), cos: +cos.toFixed(3) });
  }
}
rows.sort((x, y) => y.emb - x.emb);
console.log("Top 6 cross-catalog pairs (by embedding):");
console.table(rows.slice(0, 6));
console.log("min hashDist across catalog:", Math.min(...rows.map((r) => r.hashDist)));
