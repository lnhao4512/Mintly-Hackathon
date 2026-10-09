"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRUSHES, ERASER_BRUSH, beginSmudge, beginStroke, getBrush, hexToRgb, type BrushId, type Rect, type StrokeHandle } from "@/lib/paint/brushes";
import type { DraftPayload } from "@/lib/paint/draftStore";
import { useI18n } from "@/lib/i18n";

export type Tool = "brush" | "smudge" | "eraser" | "fill" | "eyedropper" | "text";
export type LayerBlend = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blend: LayerBlend;
}

export interface DrawingState {
  tool: Tool;
  brushId: BrushId;
  color: string;
  brushSize: number;
  opacity: number;
  textValue: string;
  canUndo: boolean;
  canRedo: boolean;
  isPixelMode: boolean;
  zoomScale: number;
  layers: LayerInfo[];
  activeLayerId: string;
  isDirty: boolean;
  /** bumps whenever pixels change so thumbnails can refresh */
  thumbTick: number;
  recentColors: string[];
  /** artboard size in pixels */
  canvasSize: { w: number; h: number };
}

export interface CreationTrace {
  method: "drawn" | "imported";
  strokes: number;
  durationMs: number;
  frames: string[];
}

export interface DrawingActions {
  setTool: (tool: Tool) => void;
  setBrushId: (id: BrushId) => void;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setOpacity: (opacity: number) => void;
  setTextValue: (value: string) => void;
  setPixelMode: (mode: boolean) => void;
  setZoomScale: (scale: number | ((s: number) => number)) => void;
  undo: () => void;
  redo: () => void;
  /** reset everything: one blank layer, empty history, fresh time-lapse */
  clear: () => void;
  /** wipe only the active layer (undoable) */
  clearLayer: () => void;
  exportToBase64: () => Promise<string | null>;
  loadImage: (source: File | string) => Promise<boolean>;
  getCreationTrace: () => CreationTrace;
  getLiveFrame: () => string | null;
  // layers
  addLayer: () => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  mergeDown: (id: string) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisible: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setLayerBlend: (id: string, blend: LayerBlend) => void;
  renameLayer: (id: string, name: string) => void;
  moveLayer: (id: string, dir: 1 | -1) => void;
  getLayerCanvas: (id: string) => HTMLCanvasElement | undefined;
  /** resize the artboard; existing artwork stays centred (cropped or padded), history is reset */
  setCanvasSize: (w: number, h: number) => void;
  // drafts
  serializeDraft: (meta: { title: string; statement: string }) => DraftPayload | null;
  restoreDraft: (draft: DraftPayload) => Promise<void>;
  markClean: () => void;
}

export const DEFAULT_CANVAS_SIZE = 1080;
export const MIN_CANVAS_SIZE = 256;
export const MAX_CANVAS_SIZE = 2048;
const MAX_HISTORY = 80;
const TRACE_FRAME_SIZE = 240;
const TRACE_MAX_FRAMES = 60;
const TRACE_MIN_GAP_MS = 400;

type HItem =
  | { t: "px"; id: string; rect: Rect; before: ImageData; after: ImageData }
  | { t: "add"; meta: LayerInfo; index: number; pixels?: ImageData }
  | { t: "del"; meta: LayerInfo; index: number; pixels: ImageData }
  | { t: "order"; id: string; from: number; to: number }
  | { t: "group"; items: HItem[] };

const uid = () => `l_${Math.random().toString(36).slice(2, 9)}`;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Layered painting engine.
 * - every layer is an offscreen canvas; the visible <canvas> only shows the composite
 * - strokes are stamped by lib/paint/brushes and recorded as small rectangle patches for undo
 * - fill / eyedropper sample the merged image, text and fills write to the active layer
 */
export function useDrawingCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const { L } = useI18n();

  const sizeRef = useRef({ w: DEFAULT_CANVAS_SIZE, h: DEFAULT_CANVAS_SIZE });
  const [canvasSize, setCanvasSizeState] = useState({ w: DEFAULT_CANVAS_SIZE, h: DEFAULT_CANVAS_SIZE });
  const layerCanvases = useRef(new Map<string, HTMLCanvasElement>());
  const layersRef = useRef<LayerInfo[]>([]);
  const activeRef = useRef("");
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [activeLayerId, setActiveLayerIdState] = useState("");

  const [tool, setToolState] = useState<Tool>("brush");
  const [brushId, setBrushIdState] = useState<BrushId>("pencil");
  const [color, setColorState] = useState("#141313");
  const [brushSize, setBrushSize] = useState(BRUSHES[0].defaultSize);
  const [opacity, setOpacity] = useState(1);
  const [textValue, setTextValue] = useState("MINTLY");
  const [zoomScale, setZoomScale] = useState(1);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [thumbTick, setThumbTick] = useState(0);
  const [histTick, setHistTick] = useState(0);

  const undoStack = useRef<HItem[]>([]);
  const redoStack = useRef<HItem[]>([]);
  const strokeRef = useRef<{ h: StrokeHandle; layerId: string; kind: Tool } | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const initedRef = useRef(false);
  const lastDisplayRef = useRef<HTMLCanvasElement | null>(null);
  const prevToolRef = useRef<Tool>("brush");

  const traceRef = useRef({ frames: [] as string[], strokes: 0, startedAt: 0, lastFrameAt: 0, imported: false });

  // fresh values for event handlers without re-binding
  const cfg = useRef({ tool, brushId, color, brushSize, opacity, textValue });
  cfg.current = { tool, brushId, color, brushSize, opacity, textValue };

  // ---------------------------------------------------------------- state helpers
  const commitLayers = useCallback((next: LayerInfo[]) => {
    layersRef.current = next;
    setLayers(next);
  }, []);
  const commitActive = useCallback((id: string) => {
    activeRef.current = id;
    setActiveLayerIdState(id);
  }, []);
  const bump = useCallback(() => setThumbTick((n) => n + 1), []);

  // ---------------------------------------------------------------- display composite
  const displayCtx = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    if (c.width !== sizeRef.current.w) c.width = sizeRef.current.w;
    if (c.height !== sizeRef.current.h) c.height = sizeRef.current.h;
    return c.getContext("2d");
  }, [canvasRef]);

  const composite = useCallback(
    (rect?: Rect) => {
      const ctx = displayCtx();
      if (!ctx) return;
      const r = rect ?? { x: 0, y: 0, w: sizeRef.current.w, h: sizeRef.current.h };
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(r.x, r.y, r.w, r.h);
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      for (const l of layersRef.current) {
        if (!l.visible) continue;
        const cv = layerCanvases.current.get(l.id);
        if (!cv) continue;
        ctx.globalAlpha = l.opacity;
        ctx.globalCompositeOperation = l.blend;
        ctx.drawImage(cv, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      }
      ctx.restore();
    },
    [displayCtx]
  );

  // ---------------------------------------------------------------- time-lapse trace
  const captureTrace = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trace = traceRef.current;
    const now = Date.now();
    if (!trace.startedAt) trace.startedAt = now;
    if (now - trace.lastFrameAt < TRACE_MIN_GAP_MS) return;
    const thumb = document.createElement("canvas");
    const fit = TRACE_FRAME_SIZE / Math.max(canvas.width, canvas.height);
    thumb.width = Math.max(1, Math.round(canvas.width * fit));
    thumb.height = Math.max(1, Math.round(canvas.height * fit));
    const tctx = thumb.getContext("2d");
    if (!tctx) return;
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, thumb.width, thumb.height);
    tctx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    trace.frames.push(thumb.toDataURL("image/webp", 0.6));
    trace.lastFrameAt = now;
    if (trace.frames.length > TRACE_MAX_FRAMES) trace.frames = trace.frames.filter((_, i) => i % 2 === 0);
  }, [canvasRef]);

  // ---------------------------------------------------------------- history
  const pushHistory = useCallback((item: HItem) => {
    undoStack.current.push(item);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setIsDirty(true);
    setHistTick((n) => n + 1);
  }, []);

  const lctxOf = (id: string) => layerCanvases.current.get(id)?.getContext("2d") ?? null;

  const insertLayerRaw = useCallback(
    (meta: LayerInfo, index: number, pixels?: ImageData) => {
      const cv = makeCanvas(sizeRef.current.w, sizeRef.current.h);
      if (pixels) cv.getContext("2d")!.putImageData(pixels, 0, 0);
      layerCanvases.current.set(meta.id, cv);
      const next = [...layersRef.current];
      next.splice(Math.min(index, next.length), 0, meta);
      commitLayers(next);
      commitActive(meta.id);
      composite();
      bump();
    },
    [bump, commitActive, commitLayers, composite]
  );

  const removeLayerRaw = useCallback(
    (id: string) => {
      const list = layersRef.current;
      const idx = list.findIndex((l) => l.id === id);
      if (idx < 0) return;
      layerCanvases.current.delete(id);
      const next = list.filter((l) => l.id !== id);
      commitLayers(next);
      if (activeRef.current === id) commitActive(next[Math.max(0, idx - 1)]?.id ?? next[0]?.id ?? "");
      composite();
      bump();
    },
    [bump, commitActive, commitLayers, composite]
  );

  const moveRaw = useCallback(
    (id: string, from: number, to: number) => {
      const next = [...layersRef.current];
      const idx = next.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      commitLayers(next);
      composite();
    },
    [commitLayers, composite]
  );

  const undoItem = useCallback(
    (it: HItem) => {
      switch (it.t) {
        case "px":
          lctxOf(it.id)?.putImageData(it.before, it.rect.x, it.rect.y);
          composite(it.rect);
          bump();
          break;
        case "add":
          removeLayerRaw(it.meta.id);
          break;
        case "del":
          insertLayerRaw(it.meta, it.index, it.pixels);
          break;
        case "order":
          moveRaw(it.id, it.to, it.from);
          break;
        case "group":
          [...it.items].reverse().forEach(undoItem);
          break;
      }
    },
    [bump, composite, insertLayerRaw, moveRaw, removeLayerRaw]
  );

  const redoItem = useCallback(
    (it: HItem) => {
      switch (it.t) {
        case "px":
          lctxOf(it.id)?.putImageData(it.after, it.rect.x, it.rect.y);
          composite(it.rect);
          bump();
          break;
        case "add":
          insertLayerRaw(it.meta, it.index, it.pixels);
          break;
        case "del":
          removeLayerRaw(it.meta.id);
          break;
        case "order":
          moveRaw(it.id, it.from, it.to);
          break;
        case "group":
          it.items.forEach(redoItem);
          break;
      }
    },
    [bump, composite, insertLayerRaw, moveRaw, removeLayerRaw]
  );

  const undo = useCallback(() => {
    const it = undoStack.current.pop();
    if (!it) return;
    undoItem(it);
    redoStack.current.push(it);
    setIsDirty(true);
    setHistTick((n) => n + 1);
  }, [undoItem]);

  const redo = useCallback(() => {
    const it = redoStack.current.pop();
    if (!it) return;
    redoItem(it);
    undoStack.current.push(it);
    setIsDirty(true);
    setHistTick((n) => n + 1);
  }, [redoItem]);

  // ---------------------------------------------------------------- init (also when the canvas element remounts)
  const layerName = useCallback((n: number) => L(`Lớp ${n}`, `Layer ${n}`), [L]);

  const resetAll = useCallback(() => {
    layerCanvases.current.clear();
    undoStack.current = [];
    redoStack.current = [];
    traceRef.current = { frames: [], strokes: 0, startedAt: 0, lastFrameAt: 0, imported: false };
    const meta: LayerInfo = { id: uid(), name: layerName(1), visible: true, opacity: 1, blend: "source-over" };
    layerCanvases.current.set(meta.id, makeCanvas(sizeRef.current.w, sizeRef.current.h));
    commitLayers([meta]);
    commitActive(meta.id);
    composite();
    setIsDirty(false);
    setHistTick((n) => n + 1);
    bump();
  }, [bump, commitActive, commitLayers, composite, layerName]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    if (!initedRef.current) {
      initedRef.current = true;
      resetAll();
      lastDisplayRef.current = el;
    } else if (lastDisplayRef.current !== el) {
      lastDisplayRef.current = el;
      composite();
    }
  });

  // ---------------------------------------------------------------- coordinates
  const pointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((clientX - rect.left) * sizeRef.current.w) / (rect.width || sizeRef.current.w),
        y: ((clientY - rect.top) * sizeRef.current.h) / (rect.height || sizeRef.current.h),
      };
    },
    [canvasRef]
  );

  const ensureScratch = () => {
    if (!baseRef.current) baseRef.current = makeCanvas(sizeRef.current.w, sizeRef.current.h);
    if (!bufferRef.current) bufferRef.current = makeCanvas(sizeRef.current.w, sizeRef.current.h);
    return { base: baseRef.current, buffer: bufferRef.current };
  };

  const pushRecent = useCallback((c: string) => {
    setRecentColors((prev) => [c, ...prev.filter((x) => x !== c)].slice(0, 10));
  }, []);

  const setColor = useCallback((c: string) => setColorState(c), []);

  // ---------------------------------------------------------------- fill
  const floodFill = useCallback(
    (sx: number, sy: number) => {
      const disp = displayCtx();
      const id = activeRef.current;
      const lctx = lctxOf(id);
      if (!disp || !lctx) return;
      const W = sizeRef.current.w;
      const H = sizeRef.current.h;
      const x = Math.floor(Math.max(0, Math.min(W - 1, sx)));
      const y = Math.floor(Math.max(0, Math.min(H - 1, sy)));

      // region is decided on what you SEE (merged), paint goes to the active layer
      const merged = disp.getImageData(0, 0, W, H);
      const m32 = new Uint32Array(merged.data.buffer);
      const target = m32[y * W + x];
      const tr = target & 255, tg = (target >> 8) & 255, tb = (target >> 16) & 255, ta = (target >>> 24) & 255;
      const tol = 28;
      const match = (c: number) =>
        Math.abs((c & 255) - tr) <= tol &&
        Math.abs(((c >> 8) & 255) - tg) <= tol &&
        Math.abs(((c >> 16) & 255) - tb) <= tol &&
        Math.abs(((c >>> 24) & 255) - ta) <= tol;

      const mask = new Uint8Array(W * H);
      const stack: number[] = [x, y];
      let minX = x, maxX = x, minY = y, maxY = y;
      while (stack.length) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        let left = cx;
        while (left >= 0 && !mask[cy * W + left] && match(m32[cy * W + left])) left--;
        left++;
        let right = cx;
        while (right < W && !mask[cy * W + right] && match(m32[cy * W + right])) right++;
        right--;
        if (right < left) continue;
        for (let i = left; i <= right; i++) mask[cy * W + i] = 1;
        minX = Math.min(minX, left);
        maxX = Math.max(maxX, right);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
        for (const ny of [cy - 1, cy + 1]) {
          if (ny < 0 || ny >= H) continue;
          let inSpan = false;
          for (let i = left; i <= right; i++) {
            const idx = ny * W + i;
            if (!mask[idx] && match(m32[idx])) {
              if (!inSpan) {
                stack.push(i, ny);
                inSpan = true;
              }
            } else inSpan = false;
          }
        }
      }

      const rect: Rect = { x: Math.max(0, minX - 1), y: Math.max(0, minY - 1), w: Math.min(W, maxX + 2) - Math.max(0, minX - 1), h: Math.min(H, maxY + 2) - Math.max(0, minY - 1) };
      const before = lctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      const after = new ImageData(new Uint8ClampedArray(before.data), rect.w, rect.h);
      const [r, g, b] = hexToRgb(cfg.current.color);
      const a = Math.round(255 * cfg.current.opacity);
      const grow = (px: number, py: number) => px >= 0 && py >= 0 && px < W && py < H && mask[py * W + px];
      for (let yy = 0; yy < rect.h; yy++) {
        for (let xx = 0; xx < rect.w; xx++) {
          const gx = rect.x + xx, gy = rect.y + yy;
          // dilate by 1px so anti-aliased line edges do not leave a light halo
          if (grow(gx, gy) || grow(gx + 1, gy) || grow(gx - 1, gy) || grow(gx, gy + 1) || grow(gx, gy - 1)) {
            const i = (yy * rect.w + xx) * 4;
            after.data[i] = r;
            after.data[i + 1] = g;
            after.data[i + 2] = b;
            after.data[i + 3] = a;
          }
        }
      }
      lctx.putImageData(after, rect.x, rect.y);
      composite(rect);
      pushHistory({ t: "px", id, rect, before, after });
      pushRecent(cfg.current.color);
      traceRef.current.strokes += 1;
      captureTrace();
      bump();
    },
    [bump, captureTrace, composite, displayCtx, pushHistory, pushRecent]
  );

  // ---------------------------------------------------------------- pointer handling
  const pressureOf = (ev: PointerEvent | React.PointerEvent) =>
    ev.pointerType === "pen" ? Math.max(0.05, ev.pressure || 0.05) : 1;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const id = activeRef.current;
      const layerCv = layerCanvases.current.get(id);
      if (!layerCv) return;
      const pt = pointFromClient(e.clientX, e.clientY);
      const c = cfg.current;

      if (c.tool === "eyedropper") {
        const px = displayCtx()?.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
        if (px && px[3] > 0) {
          const hex = "#" + [px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, "0")).join("");
          setColorState(hex);
        }
        setToolState(prevToolRef.current === "eyedropper" ? "brush" : prevToolRef.current);
        return;
      }
      if (c.tool === "fill") {
        floodFill(pt.x, pt.y);
        return;
      }
      if (c.tool === "text") {
        const ctx = layerCv.getContext("2d")!;
        const fontSize = Math.max(18, c.brushSize * 4);
        ctx.save();
        ctx.font = `700 ${fontSize}px "Be Vietnam Pro", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const text = c.textValue || "MINTLY";
        const w = ctx.measureText(text).width;
        const rect: Rect = {
          x: Math.max(0, Math.floor(pt.x - 6)),
          y: Math.max(0, Math.floor(pt.y - fontSize)),
          w: Math.min(sizeRef.current.w, Math.ceil(w + 12)),
          h: Math.min(sizeRef.current.h, Math.ceil(fontSize * 2)),
        };
        rect.w = Math.min(rect.w, sizeRef.current.w - rect.x);
        rect.h = Math.min(rect.h, sizeRef.current.h - rect.y);
        const before = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
        ctx.globalAlpha = c.opacity;
        ctx.fillStyle = c.color;
        ctx.fillText(text, pt.x, pt.y);
        ctx.restore();
        const after = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
        composite(rect);
        pushHistory({ t: "px", id, rect, before, after });
        traceRef.current.strokes += 1;
        captureTrace();
        bump();
        setToolState("brush");
        return;
      }

      // painting tools: make sure the layer is visible
      const meta = layersRef.current.find((l) => l.id === id);
      if (meta && !meta.visible) {
        commitLayers(layersRef.current.map((l) => (l.id === id ? { ...l, visible: true } : l)));
        composite();
      }

      const { base, buffer } = ensureScratch();
      const bctx = base.getContext("2d")!;
      bctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
      bctx.drawImage(layerCv, 0, 0);

      const onFlush = (r: Rect) => composite(r);
      let h: StrokeHandle;
      if (c.tool === "smudge") {
        h = beginSmudge({ layer: layerCv, base, size: Math.max(10, c.brushSize), strength: 0.35 + 0.55 * c.opacity, onFlush }, pt.x, pt.y);
      } else if (c.tool === "eraser") {
        h = beginStroke({ brush: ERASER_BRUSH, color: "#000000", size: c.brushSize, opacity: c.opacity, layer: layerCv, base, buffer, erase: true, onFlush }, pt.x, pt.y, pressureOf(e));
      } else {
        h = beginStroke({ brush: getBrush(c.brushId), color: c.color, size: c.brushSize, opacity: c.opacity, layer: layerCv, base, buffer, onFlush }, pt.x, pt.y, pressureOf(e));
      }
      strokeRef.current = { h, layerId: id, kind: c.tool };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // some browsers refuse capture for synthetic events
      }
    },
    [bump, captureTrace, commitLayers, composite, displayCtx, floodFill, pointFromClient, pushHistory]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const s = strokeRef.current;
      if (!s) return;
      const native = e.nativeEvent;
      const evs = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
      const list = evs.length ? evs : [native];
      for (const ev of list) {
        const pt = pointFromClient(ev.clientX, ev.clientY);
        s.h.move(pt.x, pt.y, pressureOf(ev));
      }
    },
    [pointFromClient]
  );

  const finishStroke = useCallback(() => {
    const s = strokeRef.current;
    if (!s) return;
    strokeRef.current = null;
    const rect = s.h.end();
    const lctx = lctxOf(s.layerId);
    const bctx = baseRef.current?.getContext("2d");
    if (rect && lctx && bctx) {
      const before = bctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      const after = lctx.getImageData(rect.x, rect.y, rect.w, rect.h);
      composite(rect);
      pushHistory({ t: "px", id: s.layerId, rect, before, after });
      if (s.kind === "brush") pushRecent(cfg.current.color);
    }
    traceRef.current.strokes += 1;
    captureTrace();
    bump();
  }, [bump, captureTrace, composite, pushHistory, pushRecent]);

  // ---------------------------------------------------------------- tool / brush setters
  const setTool = useCallback((t: Tool) => {
    setToolState((cur) => {
      if (t === "eyedropper" && cur !== "eyedropper") prevToolRef.current = cur;
      return t;
    });
  }, []);

  const setBrushId = useCallback((id: BrushId) => {
    const b = getBrush(id);
    setBrushIdState(id);
    setBrushSize(b.defaultSize);
    setOpacity(b.defaultOpacity);
    setToolState("brush");
  }, []);

  const setPixelMode = useCallback(
    (on: boolean) => {
      if (on) setBrushId("pixel");
      else setBrushId("pencil");
    },
    [setBrushId]
  );

  // ---------------------------------------------------------------- layers
  const fullData = (id: string) => lctxOf(id)?.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);

  const addLayer = useCallback(() => {
    const idx = layersRef.current.findIndex((l) => l.id === activeRef.current) + 1;
    const meta: LayerInfo = { id: uid(), name: layerName(layersRef.current.length + 1), visible: true, opacity: 1, blend: "source-over" };
    insertLayerRaw(meta, idx);
    pushHistory({ t: "add", meta, index: idx });
  }, [insertLayerRaw, layerName, pushHistory]);

  const deleteLayer = useCallback(
    (id: string) => {
      const list = layersRef.current;
      const idx = list.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const pixels = fullData(id);
      if (!pixels) return;
      if (list.length === 1) {
        // the last layer can't be removed — wipe it instead
        const ctx = lctxOf(id)!;
        const before = pixels;
        ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
        const after = ctx.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);
        composite();
        pushHistory({ t: "px", id, rect: { x: 0, y: 0, w: sizeRef.current.w, h: sizeRef.current.h }, before, after });
        bump();
        return;
      }
      pushHistory({ t: "del", meta: list[idx], index: idx, pixels });
      removeLayerRaw(id);
    },
    [bump, composite, pushHistory, removeLayerRaw]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const list = layersRef.current;
      const idx = list.findIndex((l) => l.id === id);
      const src = list[idx];
      const pixels = fullData(id);
      if (!src || !pixels) return;
      const meta: LayerInfo = { ...src, id: uid(), name: `${src.name} ${L("(bản sao)", "copy")}` };
      insertLayerRaw(meta, idx + 1, pixels);
      pushHistory({ t: "add", meta, index: idx + 1, pixels });
    },
    [L, insertLayerRaw, pushHistory]
  );

  const mergeDown = useCallback(
    (id: string) => {
      const list = layersRef.current;
      const idx = list.findIndex((l) => l.id === id);
      if (idx <= 0) return;
      const upper = list[idx];
      const lower = list[idx - 1];
      const upperCv = layerCanvases.current.get(upper.id);
      const lowerCtx = lctxOf(lower.id);
      const upperPixels = fullData(upper.id);
      const lowerBefore = fullData(lower.id);
      if (!upperCv || !lowerCtx || !upperPixels || !lowerBefore) return;
      lowerCtx.save();
      lowerCtx.globalAlpha = upper.visible ? upper.opacity : 0;
      lowerCtx.globalCompositeOperation = upper.blend;
      lowerCtx.drawImage(upperCv, 0, 0);
      lowerCtx.restore();
      const lowerAfter = lowerCtx.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);
      pushHistory({
        t: "group",
        items: [
          { t: "px", id: lower.id, rect: { x: 0, y: 0, w: sizeRef.current.w, h: sizeRef.current.h }, before: lowerBefore, after: lowerAfter },
          { t: "del", meta: upper, index: idx, pixels: upperPixels },
        ],
      });
      removeLayerRaw(upper.id);
      commitActive(lower.id);
    },
    [commitActive, pushHistory, removeLayerRaw]
  );

  const patchLayer = useCallback(
    (id: string, patch: Partial<LayerInfo>) => {
      commitLayers(layersRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      composite();
      setIsDirty(true);
    },
    [commitLayers, composite]
  );

  const moveLayer = useCallback(
    (id: string, dir: 1 | -1) => {
      const from = layersRef.current.findIndex((l) => l.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= layersRef.current.length) return;
      moveRaw(id, from, to);
      pushHistory({ t: "order", id, from, to });
    },
    [moveRaw, pushHistory]
  );

  const clearLayer = useCallback(() => {
    const id = activeRef.current;
    const ctx = lctxOf(id);
    if (!ctx) return;
    const before = ctx.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);
    ctx.clearRect(0, 0, sizeRef.current.w, sizeRef.current.h);
    const after = ctx.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);
    composite();
    pushHistory({ t: "px", id, rect: { x: 0, y: 0, w: sizeRef.current.w, h: sizeRef.current.h }, before, after });
    bump();
  }, [bump, composite, pushHistory]);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = navigator.platform.toUpperCase().includes("MAC") ? e.metaKey : e.ctrlKey;
      if (mod && !typing) {
        const k = e.key.toLowerCase();
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (k === "y") {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (typing || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "[") setBrushSize((s) => Math.max(1, s - (s > 40 ? 8 : 2)));
      if (e.key === "]") setBrushSize((s) => Math.min(200, s + (s >= 40 ? 8 : 2)));
      if (e.key.toLowerCase() === "b") setToolState("brush");
      if (e.key.toLowerCase() === "e") setToolState("eraser");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redo, undo]);

  // ---------------------------------------------------------------- import / export
  const exportToBase64 = useCallback(async (): Promise<string | null> => {
    if (!canvasRef.current) return null;
    composite();
    const out = document.createElement("canvas");
    out.width = sizeRef.current.w;
    out.height = sizeRef.current.h;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sizeRef.current.w, sizeRef.current.h);
    ctx.drawImage(canvasRef.current, 0, 0);
    return out.toDataURL("image/png");
  }, [canvasRef, composite]);

  const loadImage = useCallback(
    (source: File | string): Promise<boolean> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        let objectUrl: string | null = null;
        const done = (ok: boolean) => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve(ok);
        };
        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) return done(false);
          const ratio = Math.min(sizeRef.current.w / w, sizeRef.current.h / h);
          const dw = w * ratio, dh = h * ratio;
          const meta: LayerInfo = { id: uid(), name: L("Ảnh nhập", "Imported image"), visible: true, opacity: 1, blend: "source-over" };
          const idx = layersRef.current.length;
          const tmp = makeCanvas(sizeRef.current.w, sizeRef.current.h);
          const tctx = tmp.getContext("2d")!;
          tctx.imageSmoothingQuality = "high";
          tctx.drawImage(img, (sizeRef.current.w - dw) / 2, (sizeRef.current.h - dh) / 2, dw, dh);
          const pixels = tctx.getImageData(0, 0, sizeRef.current.w, sizeRef.current.h);
          insertLayerRaw(meta, idx, pixels);
          pushHistory({ t: "add", meta, index: idx, pixels });
          traceRef.current.imported = true;
          captureTrace();
          done(true);
        };
        img.onerror = () => done(false);
        if (typeof source === "string") {
          img.src = source;
        } else {
          try {
            objectUrl = URL.createObjectURL(source);
            img.src = objectUrl;
          } catch {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (typeof ev.target?.result === "string") img.src = ev.target.result;
              else done(false);
            };
            reader.onerror = () => done(false);
            reader.readAsDataURL(source);
          }
        }
      }),
    [L, captureTrace, insertLayerRaw, pushHistory]
  );

  const getCreationTrace = useCallback((): CreationTrace => {
    const t = traceRef.current;
    return { method: t.imported ? "imported" : "drawn", strokes: t.strokes, durationMs: t.startedAt ? Date.now() - t.startedAt : 0, frames: [...t.frames] };
  }, []);

  const getLiveFrame = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const out = document.createElement("canvas");
    const fit = 480 / Math.max(canvas.width, canvas.height);
    out.width = Math.round(canvas.width * fit);
    out.height = Math.round(canvas.height * fit);
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, out.width, out.height);
    octx.drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL("image/webp", 0.6);
  }, [canvasRef]);

  // ---------------------------------------------------------------- drafts
  const serializeDraft = useCallback(
    (meta: { title: string; statement: string }): DraftPayload | null => {
      if (!canvasRef.current) return null;
      const thumb = document.createElement("canvas");
      const fit = 160 / Math.max(canvasRef.current.width, canvasRef.current.height);
      thumb.width = Math.round(canvasRef.current.width * fit);
      thumb.height = Math.round(canvasRef.current.height * fit);
      const tctx = thumb.getContext("2d")!;
      tctx.fillStyle = "#ffffff";
      tctx.fillRect(0, 0, thumb.width, thumb.height);
      tctx.drawImage(canvasRef.current, 0, 0, thumb.width, thumb.height);
      const t = traceRef.current;
      return {
        version: 1,
        size: { ...sizeRef.current },
        updatedAt: Date.now(),
        title: meta.title,
        statement: meta.statement,
        activeLayerId: activeRef.current,
        layers: layersRef.current.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blend: l.blend,
          png: layerCanvases.current.get(l.id)!.toDataURL("image/png"),
        })),
        trace: { frames: t.frames, strokes: t.strokes, startedAt: t.startedAt, imported: t.imported, elapsedMs: t.startedAt ? Date.now() - t.startedAt : 0 },
        thumb: thumb.toDataURL("image/webp", 0.6),
      };
    },
    [canvasRef]
  );

  const restoreDraft = useCallback(
    async (draft: DraftPayload) => {
      // the artboard size is part of the draft (older drafts are the default square)
      const ds = draft.size ?? { w: DEFAULT_CANVAS_SIZE, h: DEFAULT_CANVAS_SIZE };
      sizeRef.current = { w: ds.w, h: ds.h };
      setCanvasSizeState({ w: ds.w, h: ds.h });
      baseRef.current = null;
      bufferRef.current = null;
      const loaded = await Promise.all(
        draft.layers.map(
          (l) =>
            new Promise<{ meta: LayerInfo; cv: HTMLCanvasElement }>((resolve) => {
              const cv = makeCanvas(sizeRef.current.w, sizeRef.current.h);
              const img = new Image();
              img.onload = () => {
                cv.getContext("2d")!.drawImage(img, 0, 0);
                resolve({ meta: { id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend as LayerBlend }, cv });
              };
              img.onerror = () => resolve({ meta: { id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend as LayerBlend }, cv });
              img.src = l.png;
            })
        )
      );
      layerCanvases.current.clear();
      loaded.forEach(({ meta, cv }) => layerCanvases.current.set(meta.id, cv));
      commitLayers(loaded.map((x) => x.meta));
      commitActive(loaded.some((x) => x.meta.id === draft.activeLayerId) ? draft.activeLayerId : loaded[loaded.length - 1]?.meta.id ?? "");
      undoStack.current = [];
      redoStack.current = [];
      const now = Date.now();
      traceRef.current = {
        frames: draft.trace.frames,
        strokes: draft.trace.strokes,
        // keep the elapsed drawing time continuous across sessions
        startedAt: now - (draft.trace.elapsedMs || 0),
        lastFrameAt: 0,
        imported: draft.trace.imported,
      };
      composite();
      setIsDirty(false);
      setHistTick((n) => n + 1);
      bump();
    },
    [bump, commitActive, commitLayers, composite]
  );

  const setCanvasSize = useCallback(
    (wIn: number, hIn: number) => {
      const clamp = (v: number) => Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(v) || DEFAULT_CANVAS_SIZE));
      const w = clamp(wIn);
      const h = clamp(hIn);
      const old = sizeRef.current;
      if (old.w === w && old.h === h) return;
      const dx = Math.round((w - old.w) / 2);
      const dy = Math.round((h - old.h) / 2);
      // keep the artwork centred: the frame crops it or pads it with transparency
      layerCanvases.current.forEach((cv, id) => {
        const next = makeCanvas(w, h);
        next.getContext("2d")!.drawImage(cv, dx, dy);
        layerCanvases.current.set(id, next);
      });
      baseRef.current = null;
      bufferRef.current = null;
      sizeRef.current = { w, h };
      setCanvasSizeState({ w, h });
      // history patches belong to the old geometry
      undoStack.current = [];
      redoStack.current = [];
      composite();
      setIsDirty(true);
      setHistTick((n) => n + 1);
      bump();
    },
    [bump, composite]
  );

  const markClean = useCallback(() => setIsDirty(false), []);

  // ---------------------------------------------------------------- public API
  void histTick;
  const state: DrawingState = {
    tool,
    brushId,
    color,
    brushSize,
    opacity,
    textValue,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    isPixelMode: brushId === "pixel",
    zoomScale,
    layers,
    activeLayerId,
    isDirty,
    thumbTick,
    recentColors,
    canvasSize,
  };

  const actions: DrawingActions = {
    setTool,
    setBrushId,
    setColor,
    setBrushSize,
    setOpacity,
    setTextValue,
    setPixelMode,
    setZoomScale,
    undo,
    redo,
    clear: resetAll,
    clearLayer,
    exportToBase64,
    loadImage,
    getCreationTrace,
    getLiveFrame,
    addLayer,
    deleteLayer,
    duplicateLayer,
    mergeDown,
    setActiveLayer: commitActive,
    toggleLayerVisible: (id) => patchLayer(id, { visible: !layersRef.current.find((l) => l.id === id)?.visible }),
    setLayerOpacity: (id, v) => patchLayer(id, { opacity: v }),
    setLayerBlend: (id, blend) => patchLayer(id, { blend }),
    renameLayer: (id, name) => patchLayer(id, { name: name.slice(0, 40) || "—" }),
    moveLayer,
    getLayerCanvas: (id) => layerCanvases.current.get(id),
    setCanvasSize,
    serializeDraft,
    restoreDraft,
    markClean,
  };

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishStroke,
    onPointerCancel: finishStroke,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { state, actions, handlers };
}
