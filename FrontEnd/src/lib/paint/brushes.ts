/**
 * Brush engine for the Studio.
 *
 * Every stroke is stamped as "dabs" along the pointer path into a scratch buffer. After each move the
 * affected rectangle of the target layer is rebuilt as  base + buffer (at stroke opacity, with the
 * brush's blend mode). This keeps overlapping dabs from stacking past the stroke opacity (marker),
 * lets watercolor build up inside one stroke, and makes undo cheap (only the touched rectangle).
 */

export type BrushId = "pencil" | "ink" | "marker" | "airbrush" | "watercolor" | "wax" | "charcoal" | "spray" | "pixel";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BrushDef {
  id: BrushId;
  vi: string;
  en: string;
  descVi: string;
  descEn: string;
  /** distance between dabs as a fraction of the diameter */
  spacing: number;
  /** alpha of one dab */
  flow: number;
  /** 0..1 paper tooth: carves holes out of every dab */
  grain: number;
  /** random position offset, fraction of radius */
  jitter: number;
  /** random size variation 0..1 */
  sizeJitter: number;
  /** how the finished stroke is blended onto the layer */
  blend: GlobalCompositeOperation;
  /** default stabiliser 0..0.9 (higher = smoother, laggier) */
  smoothing: number;
  pressureSize: boolean;
  pressureFlow: boolean;
  /** dab shape */
  shape: "hard" | "soft" | "wet" | "scatter" | "square";
  /** width follows pointer speed */
  taper?: boolean;
  defaultSize: number;
  defaultOpacity: number;
}

export const BRUSHES: BrushDef[] = [
  {
    id: "pencil", vi: "Bút chì", en: "Pencil",
    descVi: "Nét chì có vân giấy", descEn: "Graphite with paper tooth",
    spacing: 0.08, flow: 0.85, grain: 0.55, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0.2,
    pressureSize: false, pressureFlow: true, shape: "hard", defaultSize: 5, defaultOpacity: 1,
  },
  {
    id: "ink", vi: "Bút mực", en: "Ink pen",
    descVi: "Nét thanh đậm theo tốc độ tay", descEn: "Line weight follows your speed",
    spacing: 0.05, flow: 1, grain: 0, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0.55,
    pressureSize: true, pressureFlow: false, shape: "hard", taper: true, defaultSize: 10, defaultOpacity: 1,
  },
  {
    id: "marker", vi: "Bút dạ", en: "Marker",
    descVi: "Trong suốt, chồng nét sẽ đậm hơn", descEn: "Translucent; overlaps darken",
    spacing: 0.05, flow: 0.9, grain: 0.08, jitter: 0, sizeJitter: 0, blend: "multiply", smoothing: 0.3,
    pressureSize: false, pressureFlow: false, shape: "hard", defaultSize: 30, defaultOpacity: 0.55,
  },
  {
    id: "airbrush", vi: "Phun sơn", en: "Airbrush",
    descVi: "Mịn, loang mềm", descEn: "Soft, smooth falloff",
    spacing: 0.12, flow: 0.1, grain: 0.1, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0.3,
    pressureSize: false, pressureFlow: true, shape: "soft", defaultSize: 70, defaultOpacity: 1,
  },
  {
    id: "watercolor", vi: "Màu nước", en: "Watercolor",
    descVi: "Loang ướt, viền đậm, chồng lớp trong suốt", descEn: "Wet wash, pooled edges, glazing",
    spacing: 0.1, flow: 0.12, grain: 0.35, jitter: 0.12, sizeJitter: 0.12, blend: "multiply", smoothing: 0.45,
    pressureSize: true, pressureFlow: true, shape: "wet", defaultSize: 52, defaultOpacity: 0.9,
  },
  {
    id: "wax", vi: "Sáp màu", en: "Wax crayon",
    descVi: "Thô, bám vân giấy", descEn: "Waxy, catches the paper grain",
    spacing: 0.07, flow: 0.8, grain: 0.75, jitter: 0.06, sizeJitter: 0.08, blend: "source-over", smoothing: 0.15,
    pressureSize: false, pressureFlow: true, shape: "hard", defaultSize: 26, defaultOpacity: 1,
  },
  {
    id: "charcoal", vi: "Than vẽ", en: "Charcoal",
    descVi: "Đậm nhạt theo lực tay, bụi than", descEn: "Pressure-sensitive, dusty",
    spacing: 0.09, flow: 0.55, grain: 0.9, jitter: 0.1, sizeJitter: 0.15, blend: "source-over", smoothing: 0.2,
    pressureSize: true, pressureFlow: true, shape: "hard", defaultSize: 24, defaultOpacity: 1,
  },
  {
    id: "spray", vi: "Bụi sơn", en: "Spray",
    descVi: "Rắc hạt li ti", descEn: "Scattered speckles",
    spacing: 0.15, flow: 0.6, grain: 0, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0.1,
    pressureSize: false, pressureFlow: false, shape: "scatter", defaultSize: 64, defaultOpacity: 1,
  },
  {
    id: "pixel", vi: "Pixel", en: "Pixel",
    descVi: "Ô vuông sắc nét kiểu 8-bit", descEn: "Crisp 8-bit blocks",
    spacing: 0.5, flow: 1, grain: 0, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0,
    pressureSize: false, pressureFlow: false, shape: "square", defaultSize: 12, defaultOpacity: 1,
  },
];

export const ERASER_BRUSH: BrushDef = {
  id: "pencil", vi: "Tẩy", en: "Eraser", descVi: "", descEn: "",
  spacing: 0.06, flow: 1, grain: 0, jitter: 0, sizeJitter: 0, blend: "source-over", smoothing: 0.1,
  pressureSize: false, pressureFlow: false, shape: "hard", defaultSize: 30, defaultOpacity: 1,
};

export function getBrush(id: BrushId): BrushDef {
  return BRUSHES.find((b) => b.id === id) ?? BRUSHES[0];
}

// ---------------------------------------------------------------- helpers

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h.length === 6 ? h : "141313", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function unionRect(a: Rect | null, x: number, y: number, w: number, h: number): Rect {
  if (!a) return { x, y, w, h };
  const x2 = Math.max(a.x + a.w, x + w);
  const y2 = Math.max(a.y + a.h, y + h);
  const nx = Math.min(a.x, x);
  const ny = Math.min(a.y, y);
  return { x: nx, y: ny, w: x2 - nx, h: y2 - ny };
}

function clampRect(r: Rect, W: number, H: number): Rect | null {
  const x = Math.max(0, Math.floor(r.x));
  const y = Math.max(0, Math.floor(r.y));
  const x2 = Math.min(W, Math.ceil(r.x + r.w));
  const y2 = Math.min(H, Math.ceil(r.y + r.h));
  if (x2 <= x || y2 <= y) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}

// ---------------------------------------------------------------- paper grain

const noiseCache = new Map<number, HTMLCanvasElement>();

/** Tileable paper-tooth mask (alpha channel only). Coarse blotches + fine speckle. */
function getNoise(grain: number): HTMLCanvasElement {
  const key = Math.round(grain * 20);
  const cached = noiseCache.get(key);
  if (cached) return cached;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const cs = 32;
  const coarse = new Float32Array(cs * cs);
  for (let i = 0; i < coarse.length; i++) coarse[i] = Math.random();
  const sample = (x: number, y: number) => {
    const u = (x / S) * cs;
    const v = (y / S) * cs;
    const x0 = Math.floor(u) % cs, y0 = Math.floor(v) % cs;
    const x1 = (x0 + 1) % cs, y1 = (y0 + 1) % cs;
    const fx = u - Math.floor(u), fy = v - Math.floor(v);
    const a = coarse[y0 * cs + x0] * (1 - fx) + coarse[y0 * cs + x1] * fx;
    const b = coarse[y1 * cs + x0] * (1 - fx) + coarse[y1 * cs + x1] * fx;
    return a * (1 - fy) + b * fy;
  };
  const g = key / 20;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = 0.4 * sample(x, y) + 0.6 * Math.random();
      const a = clamp(1 - g * (1 - n) * 1.7, 0, 1);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  noiseCache.set(key, c);
  return c;
}

// ---------------------------------------------------------------- dabs

interface DabCtx {
  buffer: CanvasRenderingContext2D;
  dab: HTMLCanvasElement;
  dabCtx: CanvasRenderingContext2D;
}

function paintShape(ctx: CanvasRenderingContext2D, b: BrushDef, cx: number, cy: number, r: number, alpha: number, col: [number, number, number], gridSize?: number) {
  switch (b.shape) {
    case "soft": {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(col, alpha));
      g.addColorStop(0.45, rgba(col, alpha * 0.55));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "wet": {
      // pigment pools at the rim: darker ring, lighter centre, soft outer edge
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(col, alpha * 0.5));
      g.addColorStop(0.62, rgba(col, alpha * 0.78));
      g.addColorStop(0.9, rgba(col, alpha * 1.25));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "scatter": {
      ctx.fillStyle = rgba(col, alpha);
      const n = Math.round(6 + r * 0.9);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        const s = 0.6 + Math.random() * 1.6;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "square": {
      const s = Math.max(1, gridSize ?? r * 2);
      ctx.fillStyle = rgba(col, alpha);
      ctx.fillRect(Math.floor(cx / s) * s, Math.floor(cy / s) * s, s, s);
      break;
    }
    default: {
      ctx.fillStyle = rgba(col, alpha);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function stampDab(d: DabCtx, b: BrushDef, x: number, y: number, r: number, alpha: number, col: [number, number, number], size: number): Rect {
  const pad = Math.ceil(r * (1 + b.jitter)) + 3;
  if (b.grain > 0 && b.shape !== "scatter") {
    const dim = pad * 2;
    if (d.dab.width < dim || d.dab.height < dim) {
      d.dab.width = d.dab.height = Math.ceil(dim * 1.25);
    }
    const dc = d.dabCtx;
    dc.setTransform(1, 0, 0, 1, 0, 0);
    dc.globalCompositeOperation = "source-over";
    dc.clearRect(0, 0, d.dab.width, d.dab.height);
    paintShape(dc, b, pad, pad, r, alpha, col);
    // grain anchored to the page (not the dab) so the texture stays still while you drag
    const pat = dc.createPattern(getNoise(b.grain), "repeat");
    if (pat) {
      pat.setTransform(new DOMMatrix().translate(-(x - pad), -(y - pad)));
      dc.globalCompositeOperation = "destination-in";
      dc.fillStyle = pat;
      dc.fillRect(0, 0, dim, dim);
      dc.globalCompositeOperation = "source-over";
    }
    d.buffer.drawImage(d.dab, 0, 0, dim, dim, x - pad, y - pad, dim, dim);
  } else {
    paintShape(d.buffer, b, x, y, r, alpha, col, b.shape === "square" ? Math.max(1, Math.round(size)) : undefined);
  }
  return { x: x - pad, y: y - pad, w: pad * 2, h: pad * 2 };
}

// ---------------------------------------------------------------- stroke

export interface StrokeOpts {
  brush: BrushDef;
  color: string;
  size: number;
  opacity: number;
  /** layer canvas that receives the result */
  layer: HTMLCanvasElement;
  /** copy of the layer taken before the stroke */
  base: HTMLCanvasElement;
  /** scratch canvas the same size as the layer */
  buffer: HTMLCanvasElement;
  erase?: boolean;
  smoothing?: number;
  /** called with the rectangle that changed after every flush */
  onFlush?: (r: Rect) => void;
}

export interface StrokeHandle {
  move(x: number, y: number, pressure?: number): void;
  end(): Rect | null;
}

export function beginStroke(o: StrokeOpts, x0: number, y0: number, p0 = 1): StrokeHandle {
  const { brush: b, layer, base, buffer } = o;
  const W = layer.width, H = layer.height;
  const bctx = buffer.getContext("2d")!;
  const lctx = layer.getContext("2d")!;
  const col = hexToRgb(o.color);
  const dabCanvas = document.createElement("canvas");
  dabCanvas.width = dabCanvas.height = 64;
  const dabCtx = dabCanvas.getContext("2d")!;
  const dc: DabCtx = { buffer: bctx, dab: dabCanvas, dabCtx };

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.globalCompositeOperation = "source-over";
  bctx.globalAlpha = 1;
  bctx.clearRect(0, 0, W, H);

  const stab = o.smoothing ?? b.smoothing;
  let raw = { x: x0, y: y0, p: p0 };
  let pos = { x: x0, y: y0, p: p0 };
  let last = { x: x0, y: y0 };
  let carry = 0;
  let dirty: Rect | null = null;
  let total: Rect | null = null;
  let speedFactor = 1;
  let lastT = performance.now();

  const radiusFor = (p: number) => {
    let r = o.size / 2;
    if (b.pressureSize) r *= 0.35 + 0.65 * p;
    if (b.taper) r *= speedFactor;
    if (b.sizeJitter) r *= 1 + (Math.random() - 0.5) * 2 * b.sizeJitter;
    return Math.max(0.6, r);
  };

  const dabAt = (x: number, y: number, p: number) => {
    const r = radiusFor(p);
    const alpha = b.flow * (b.pressureFlow ? 0.25 + 0.75 * p : 1);
    const jx = b.jitter ? (Math.random() - 0.5) * 2 * b.jitter * r : 0;
    const jy = b.jitter ? (Math.random() - 0.5) * 2 * b.jitter * r : 0;
    const rect = stampDab(dc, b, x + jx, y + jy, r, alpha, col, o.size);
    dirty = unionRect(dirty, rect.x, rect.y, rect.w, rect.h);
    total = unionRect(total, rect.x, rect.y, rect.w, rect.h);
  };

  const flush = () => {
    if (!dirty) return;
    const r = clampRect(dirty, W, H);
    dirty = null;
    if (!r) return;
    lctx.save();
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(r.x, r.y, r.w, r.h);
    lctx.drawImage(base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    lctx.globalCompositeOperation = o.erase ? "destination-out" : b.blend;
    lctx.globalAlpha = o.opacity;
    lctx.drawImage(buffer, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    lctx.restore();
    o.onFlush?.(r);
  };

  const advance = (tx: number, ty: number, tp: number) => {
    const dx = tx - last.x;
    const dy = ty - last.y;
    const dist = Math.hypot(dx, dy);
    const spacing = Math.max(1, o.size * b.spacing);
    let d = spacing - carry;
    if (dist === 0) return;
    while (d <= dist) {
      const t = d / dist;
      dabAt(last.x + dx * t, last.y + dy * t, pos.p + (tp - pos.p) * t);
      d += spacing;
    }
    carry = dist - (d - spacing);
    last = { x: tx, y: ty };
  };

  // first dab
  dabAt(x0, y0, p0);
  flush();

  return {
    move(x: number, y: number, pressure = 1) {
      raw = { x, y, p: pressure };
      const now = performance.now();
      if (b.taper) {
        const v = Math.hypot(x - pos.x, y - pos.y) / Math.max(1, now - lastT);
        const target = clamp(1.15 - v * 0.55, 0.35, 1.15);
        speedFactor += (target - speedFactor) * 0.2;
      }
      lastT = now;
      const k = 1 - stab;
      pos = { x: pos.x + (raw.x - pos.x) * k, y: pos.y + (raw.y - pos.y) * k, p: pos.p + (raw.p - pos.p) * 0.5 };
      advance(pos.x, pos.y, pos.p);
      flush();
    },
    end() {
      // catch up to the true pointer position so the stroke finishes where the hand stopped
      advance(raw.x, raw.y, raw.p);
      flush();
      return total ? clampRect(total, W, H) : null;
    },
  };
}

// ---------------------------------------------------------------- smudge / blend

export interface SmudgeOpts {
  layer: HTMLCanvasElement;
  base: HTMLCanvasElement;
  size: number;
  strength: number; // 0..1 how much paint is dragged along
  onFlush?: (r: Rect) => void;
}

/** Drags existing pixels along the stroke (finger-painting / colour blending). */
export function beginSmudge(o: SmudgeOpts, x0: number, y0: number): StrokeHandle {
  const { layer } = o;
  const W = layer.width, H = layer.height;
  const lctx = layer.getContext("2d")!;
  const d = Math.max(8, Math.ceil(o.size));
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = d;
    return c;
  };
  const carry = mk();
  const tmp = mk();
  const out = mk();
  const cctx = carry.getContext("2d")!;
  const tctx = tmp.getContext("2d")!;
  const octx = out.getContext("2d")!;
  let last = { x: x0, y: y0 };
  let total: Rect | null = null;
  const r = d / 2;

  const sampleInto = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.clearRect(0, 0, d, d);
    ctx.drawImage(layer, x - r, y - r, d, d, 0, 0, d, d);
  };
  sampleInto(cctx, x0, y0);

  const mask = (ctx: CanvasRenderingContext2D) => {
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, d, d);
    ctx.globalCompositeOperation = "source-over";
  };

  const dab = (x: number, y: number) => {
    // pick up what is under the brush, then lay the carried paint down
    sampleInto(tctx, x, y);
    // carry = carry * strength + sample * (1 - strength)
    octx.clearRect(0, 0, d, d);
    octx.drawImage(tmp, 0, 0);
    octx.globalAlpha = o.strength;
    octx.drawImage(carry, 0, 0);
    octx.globalAlpha = 1;
    cctx.clearRect(0, 0, d, d);
    cctx.drawImage(out, 0, 0);

    octx.clearRect(0, 0, d, d);
    octx.drawImage(carry, 0, 0);
    mask(octx);
    lctx.save();
    lctx.globalAlpha = 0.55 + 0.4 * o.strength;
    lctx.globalCompositeOperation = "source-over";
    lctx.drawImage(out, x - r, y - r);
    lctx.restore();
    const rect = { x: x - r, y: y - r, w: d, h: d };
    total = unionRect(total, rect.x, rect.y, rect.w, rect.h);
    const cr = clampRect(rect, W, H);
    if (cr) o.onFlush?.(cr);
  };

  return {
    move(x: number, y: number) {
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.max(2, d * 0.14);
      for (let t = step; t <= dist; t += step) dab(last.x + (dx * t) / dist, last.y + (dy * t) / dist);
      if (dist > 0) last = { x, y };
    },
    end() {
      return total ? clampRect(total, W, H) : null;
    },
  };
}

// ---------------------------------------------------------------- previews

/** Draws a small S-curve with the real engine so brush cards show what the brush really does. */
export function renderBrushPreview(canvas: HTMLCanvasElement, brush: BrushDef, color: string) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return c;
  };
  const base = mk();
  const buffer = mk();
  const size = Math.min(H * 0.42, brush.defaultSize * (brush.id === "pixel" ? 0.8 : 0.45)) || 8;
  const h = beginStroke(
    { brush, color, size: Math.max(3, size), opacity: Math.max(0.7, brush.defaultOpacity), layer: canvas, base, buffer, smoothing: 0 },
    W * 0.1,
    H * 0.5,
    0.3
  );
  const N = 36;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const p = 0.3 + 0.7 * Math.sin(t * Math.PI);
    h.move(W * (0.1 + 0.8 * t), H * (0.5 + 0.22 * Math.sin(t * Math.PI * 2)), p);
  }
  h.end();
}
