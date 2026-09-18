"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface DrawingState {
  tool: "pencil" | "eraser" | "eyedropper" | "text" | "fill";
  color: string;
  brushSize: number;
  textValue: string;
  canUndo: boolean;
  canRedo: boolean;
  isPixelMode: boolean;
  zoomScale: number;
}

export interface DrawingActions {
  setTool: (tool: "pencil" | "eraser" | "eyedropper" | "text" | "fill") => void;
  setColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setTextValue: (value: string) => void;
  setPixelMode: (mode: boolean) => void;
  setZoomScale: (scale: number | ((s: number) => number)) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportToBase64: () => Promise<string | null>;
  loadImage: (source: File | string) => Promise<boolean>;
}

interface Point {
  x: number;
  y: number;
}

const MAX_HISTORY = 50;
const CANVAS_RESOLUTION = 1080; // Standard NFT square size

/**
 * Custom hook that manages an HTML5 Canvas drawing engine.
 *
 * Features:
 * - Fixed 1080x1080 internal resolution for high-quality export
 * - Freehand drawing with quadratic Bézier smoothing
 * - Eraser (destination-out compositing, NO white painting)
 * - Undo / Redo with snapshot stack
 * - Pixel Mode for retro 8-bit blocky drawing
 * - Zoom & Pan ready (zoom state included)
 * - Eyedropper tool to pick color from canvas
 * - Export to Base64 (DataURL)
 */
export function useDrawingCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);

  const [tool, setTool] = useState<"pencil" | "eraser" | "eyedropper" | "text" | "fill">("pencil");
  const [color, setColor] = useState("#141313");
  const [brushSize, setBrushSize] = useState(8);
  const [textValue, setTextValue] = useState("MINTLY");
  const [isPixelMode, setPixelMode] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);

  // ---- Get Context Helper --------------------------------------------------
  const getContext = useCallback((): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    if (canvas.width !== CANVAS_RESOLUTION) canvas.width = CANVAS_RESOLUTION;
    if (canvas.height !== CANVAS_RESOLUTION) canvas.height = CANVAS_RESOLUTION;

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.imageSmoothingEnabled = true;
        ctx.globalCompositeOperation = "source-over";
        ctxRef.current = ctx;
      }
    }

    return ctx ? { canvas, ctx } : null;
  }, [canvasRef]);

  // ---- Initialise canvas context -------------------------------------------
  const initCanvas = useCallback(() => {
    const context = getContext();
    if (!context) return;
    const { canvas, ctx } = context;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "source-over";

    // Save initial state if empty
    setUndoStack((prev) => {
      if (prev.length === 0) {
        const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return [initial];
      }
      return prev;
    });
  }, [getContext]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  // ---- Save snapshot -------------------------------------------------------
  const saveSnapshot = useCallback(() => {
    const context = getContext();
    if (!context) return;
    const { canvas, ctx } = context;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    setRedoStack([]);
  }, [getContext]);

  // ---- Coordinate helper ---------------------------------------------------
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      // getBoundingClientRect returns the actual visual size (including CSS scale/transform)
      const rect = canvas.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;

      if ("touches" in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("clientX" in e) {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      // Map screen coordinates to 1080x1080 internal resolution
      const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
      const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [canvasRef]
  );

function parseHexColor(hex: string): { r: number; g: number; b: number; a: number } {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  if (cleanHex.length === 6) {
    return {
      r: Number.parseInt(cleanHex.substring(0, 2), 16) || 0,
      g: Number.parseInt(cleanHex.substring(2, 4), 16) || 0,
      b: Number.parseInt(cleanHex.substring(4, 6), 16) || 0,
      a: 255,
    };
  }
  return { r: 20, g: 19, b: 19, a: 255 };
}

  const floodFill = useCallback(
    (startX: number, startY: number) => {
      const context = getContext();
      if (!context) return;
      const { canvas, ctx } = context;

      const width = canvas.width;
      const height = canvas.height;

      const x = Math.floor(Math.max(0, Math.min(width - 1, startX)));
      const y = Math.floor(Math.max(0, Math.min(height - 1, startY)));

      const imageData = ctx.getImageData(0, 0, width, height);
      const data32 = new Uint32Array(imageData.data.buffer);

      const targetColor = data32[y * width + x];

      const { r, g, b, a } = parseHexColor(color);
      // Little-endian Uint32: (A << 24) | (B << 16) | (G << 8) | R
      const fillColor =
        ((a & 0xff) << 24) |
        ((b & 0xff) << 16) |
        ((g & 0xff) << 8) |
        (r & 0xff);

      if (targetColor === fillColor) return;

      const tr = targetColor & 0xff;
      const tg = (targetColor >> 8) & 0xff;
      const tb = (targetColor >> 16) & 0xff;
      const ta = (targetColor >> 24) & 0xff;

      const tolerance = 24; // Tolerance for slight anti-aliasing differences
      const matchesTarget = (c: number) => {
        if (c === targetColor) return true;
        const cr = c & 0xff;
        const cg = (c >> 8) & 0xff;
        const cb = (c >> 16) & 0xff;
        const ca = (c >> 24) & 0xff;
        return (
          Math.abs(cr - tr) <= tolerance &&
          Math.abs(cg - tg) <= tolerance &&
          Math.abs(cb - tb) <= tolerance &&
          Math.abs(ca - ta) <= tolerance
        );
      };

      // High-performance Scanline Flood Fill
      const stack: number[] = [x, y];
      const visited = new Uint8Array(width * height);

      while (stack.length > 0) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;

        let left = cx;
        while (
          left >= 0 &&
          matchesTarget(data32[cy * width + left]) &&
          !visited[cy * width + left]
        ) {
          left--;
        }
        left++;

        let right = cx;
        while (
          right < width &&
          matchesTarget(data32[cy * width + right]) &&
          !visited[cy * width + right]
        ) {
          right++;
        }
        right--;

        for (let i = left; i <= right; i++) {
          const idx = cy * width + i;
          data32[idx] = fillColor;
          visited[idx] = 1;
        }

        // Check scanlines above and below
        for (const ny of [cy - 1, cy + 1]) {
          if (ny < 0 || ny >= height) continue;
          let inSpan = false;
          for (let i = left; i <= right; i++) {
            const idx = ny * width + i;
            if (matchesTarget(data32[idx]) && !visited[idx]) {
              if (!inSpan) {
                stack.push(i, ny);
                inSpan = true;
              }
            } else {
              inSpan = false;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      saveSnapshot();
    },
    [color, getContext, saveSnapshot]
  );

  // ---- Drawing handlers ----------------------------------------------------
  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      const context = getContext();
      if (!context) return;
      const { ctx } = context;

      if ("button" in e && (e as React.MouseEvent).button !== 0) {
        return; // Only left mouse button
      }

      const point = getCanvasPoint(e);

      // Handle Eyedropper
      if (tool === "eyedropper") {
        const pixelData = ctx.getImageData(point.x, point.y, 1, 1).data;
        if (pixelData[3] > 0) {
          const hex =
            "#" +
            [pixelData[0], pixelData[1], pixelData[2]]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("");
          setColor(hex);
        }
        setTool("pencil");
        return;
      }

      if (tool === "fill") {
        floodFill(point.x, point.y);
        return;
      }

      if (tool === "text") {
        const fontSize = Math.max(18, brushSize * 4);
        ctx.fillStyle = color;
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(textValue || "MINTLY", point.x, point.y);
        saveSnapshot();
        setTool("pencil");
        return;
      }

      isDrawingRef.current = true;
      lastPointRef.current = point;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";

      if (tool === "eraser") {
        const eraserSize = isPixelMode ? Math.max(brushSize, 2) : brushSize;
        ctx.beginPath();
        ctx.arc(point.x, point.y, eraserSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fill();
        return;
      }

      if (isPixelMode) {
        const snapX = Math.floor(point.x / Math.max(brushSize, 1)) * Math.max(brushSize, 1);
        const snapY = Math.floor(point.y / Math.max(brushSize, 1)) * Math.max(brushSize, 1);
        ctx.fillStyle = color;
        ctx.fillRect(snapX, snapY, Math.max(brushSize, 1), Math.max(brushSize, 1));
      } else {
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    },
    [tool, color, brushSize, textValue, getCanvasPoint, isPixelMode, floodFill, getContext, saveSnapshot]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
      if (!isDrawingRef.current || tool === "eyedropper" || tool === "fill" || tool === "text") return;
      const context = getContext();
      if (!context) return;
      const { ctx } = context;

      const point = getCanvasPoint(e);
      const last = lastPointRef.current;

      if (!last) {
        lastPointRef.current = point;
        return;
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";

      if (tool === "eraser") {
        const eraserSize = isPixelMode ? Math.max(brushSize, 2) : brushSize;
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = eraserSize;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else if (isPixelMode) {
        const dx = point.x - last.x;
        const dy = point.y - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const step = Math.max(1, Math.min(brushSize, 4));
        const steps = Math.max(1, Math.ceil(distance / step));

        ctx.fillStyle = color;

        for (let i = 0; i <= steps; i++) {
          const x = last.x + (dx * i) / steps;
          const y = last.y + (dy * i) / steps;
          const snapX = Math.floor(x / Math.max(brushSize, 1)) * Math.max(brushSize, 1);
          const snapY = Math.floor(y / Math.max(brushSize, 1)) * Math.max(brushSize, 1);
          ctx.fillRect(snapX, snapY, Math.max(brushSize, 1), Math.max(brushSize, 1));
        }
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }

      lastPointRef.current = point;
    },
    [getCanvasPoint, isPixelMode, brushSize, tool, color, getContext]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const context = getContext();
    if (context) {
      context.ctx.globalCompositeOperation = "source-over";
    }
    saveSnapshot();
  }, [saveSnapshot, getContext]);

  // ---- Undo / Redo ---------------------------------------------------------
  const undo = useCallback(() => {
    const context = getContext();
    if (!context || undoStack.length <= 1) return;
    const { ctx } = context;

    const newUndo = [...undoStack];
    const current = newUndo.pop()!;
    setRedoStack((prev) => [...prev, current]);

    const prev = newUndo[newUndo.length - 1];
    ctx.putImageData(prev, 0, 0);
    setUndoStack(newUndo);
  }, [undoStack, getContext]);

  const redo = useCallback(() => {
    const context = getContext();
    if (!context || redoStack.length === 0) return;
    const { ctx } = context;

    const newRedo = [...redoStack];
    const next = newRedo.pop()!;
    setUndoStack((prev) => [...prev, next]);

    ctx.putImageData(next, 0, 0);
    setRedoStack(newRedo);
  }, [redoStack, getContext]);

  // ---- Clear ---------------------------------------------------------------
  const clear = useCallback(() => {
    const context = getContext();
    if (!context) return;
    const { canvas, ctx } = context;

    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev, snapshot]);
    setRedoStack([]);
  }, [getContext]);

  // ---- Keyboard Shortcuts --------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault(); // Prevent browser undo
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key.toLowerCase() === "y") {
          e.preventDefault(); // Prevent browser redo
          redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // ---- Export ---------------------------------------------------------------
  const exportToBase64 = useCallback(async (): Promise<string | null> => {
    const context = getContext();
    if (!context) return null;
    const { canvas } = context;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;

    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return null;

    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    return exportCanvas.toDataURL("image/png");
  }, [getContext]);

  // ---- Load Image -----------------------------------------------------------
  const loadImage = useCallback(
    (source: File | string): Promise<boolean> => {
      return new Promise((resolve) => {
        const context = getContext();
        if (!context) {
          resolve(false);
          return;
        }
        const { canvas, ctx } = context;

        const img = new Image();
        img.crossOrigin = "anonymous";
        let objectUrl: string | null = null;

        const cleanup = () => {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
          }
        };

        img.onload = () => {
          try {
            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const maxDim = canvas.width;
            const imgWidth = img.naturalWidth || img.width;
            const imgHeight = img.naturalHeight || img.height;

            if (!imgWidth || !imgHeight) {
              cleanup();
              resolve(false);
              return;
            }

            // Proportionally fit image inside square canvas
            const ratio = Math.min(maxDim / imgWidth, maxDim / imgHeight);
            const drawWidth = imgWidth * ratio;
            const drawHeight = imgHeight * ratio;

            const offsetX = (canvas.width - drawWidth) / 2;
            const offsetY = (canvas.height - drawHeight) / 2;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            ctx.restore();

            saveSnapshot();
            cleanup();
            resolve(true);
          } catch (err) {
            console.error("Error drawing image:", err);
            cleanup();
            resolve(false);
          }
        };

        img.onerror = () => {
          cleanup();
          resolve(false);
        };

        if (typeof source === "string") {
          img.src = source;
        } else if (typeof window !== "undefined" && typeof (source as Blob)?.slice === "function") {
          try {
            objectUrl = URL.createObjectURL(source);
            img.src = objectUrl;
          } catch {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (typeof e.target?.result === "string") {
                img.src = e.target.result;
              } else {
                resolve(false);
              }
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(source);
          }
        } else {
          resolve(false);
        }
      });
    },
    [getContext, saveSnapshot]
  );

  // ---- Public API -----------------------------------------------------------
  const state: DrawingState = {
    tool,
    color,
    brushSize,
    textValue,
    canUndo: undoStack.length > 1,
    canRedo: redoStack.length > 0,
    isPixelMode,
    zoomScale,
  };

  const actions: DrawingActions = {
    setTool,
    setColor,
    setBrushSize,
    setTextValue,
    setPixelMode,
    setZoomScale,
    undo,
    redo,
    clear,
    exportToBase64,
    loadImage,
  };

  const handlers = {
    onPointerDown: startDrawing,
    onPointerMove: draw,
    onPointerUp: stopDrawing,
    onPointerCancel: stopDrawing,
    onMouseDown: startDrawing,
    onMouseMove: draw,
    onMouseUp: stopDrawing,
    onMouseLeave: stopDrawing,
    onTouchStart: startDrawing,
    onTouchMove: draw,
    onTouchEnd: stopDrawing,
  };

  return { state, actions, handlers };
}
