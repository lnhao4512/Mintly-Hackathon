"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";
import type { DrawingActions, DrawingState, Tool } from "@/hooks/useDrawingCanvas";
import { getBrush } from "@/lib/paint/brushes";
import { useI18n } from "@/lib/i18n";

const G = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const GLYPHS: Record<string, ReactNode> = {
  brush: (
    <G>
      <path d="M4 20c3 0 4-1.5 4-3a2.5 2.5 0 0 1 2.5-2.5" />
      <path d="m11 14 7.5-7.5a2 2 0 0 0-2.8-2.8L8.2 11" />
    </G>
  ),
  smudge: (
    <G>
      <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5m0 0V8a1.5 1.5 0 0 1 3 0v3m0 0V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-4-2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16" />
    </G>
  ),
  eraser: (
    <G>
      <path d="M8 20h11M4.5 15.5 11 9l5 5-4.5 4.5a2 2 0 0 1-2.8 0L4.5 15.5a2 2 0 0 1 0-2.8Z" />
    </G>
  ),
  fill: (
    <G>
      <path d="m5 11 7-7 7 7-6.5 6.5a2 2 0 0 1-2.8 0L5 11Z" />
      <path d="M20 16c0 1.5-1 2.5-1 2.5s-1-1-1-2.5a1 1 0 0 1 2 0Z" />
    </G>
  ),
  eyedropper: (
    <G>
      <path d="m14 6 4 4M13 7 5 15v4h4l8-8M16 4l4 4" />
    </G>
  ),
  text: (
    <G>
      <path d="M5 7V5h14v2M12 5v14M9 19h6" />
    </G>
  ),
  upload: (
    <G>
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 12V3m0 0L8 7m4-4 4 4" />
    </G>
  ),
  undo: (
    <G>
      <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12" />
    </G>
  ),
  redo: (
    <G>
      <path d="m15 7 5 5-5 5M20 12H10a6 6 0 0 0 0 12" />
    </G>
  ),
  trash: (
    <G>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </G>
  ),
  zoomIn: (
    <G>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M11 8v6M8 11h6" />
    </G>
  ),
  zoomOut: (
    <G>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3M8 11h6" />
    </G>
  ),
  full: (
    <G>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </G>
  ),
  exitFull: (
    <G>
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </G>
  ),
};

interface CanvasToolbarProps {
  state: DrawingState;
  actions: DrawingActions;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/** Floating tool belt. Brush library, colour and layers live in the side panel. */
export function CanvasToolbar({ state, actions, isFullscreen, onToggleFullscreen }: CanvasToolbarProps) {
  const { L, locale } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brush = getBrush(state.brushId);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await actions.loadImage(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const tools: { id: Tool; label: string; glyph: string; key?: string }[] = [
    { id: "brush", label: `${locale === "vi" ? brush.vi : brush.en} (B)`, glyph: "brush" },
    { id: "smudge", label: L("Pha màu / Blend", "Blend / smudge"), glyph: "smudge" },
    { id: "eraser", label: `${L("Tẩy", "Eraser")} (E)`, glyph: "eraser" },
    { id: "fill", label: L("Đổ màu", "Fill"), glyph: "fill" },
    { id: "eyedropper", label: L("Lấy màu", "Eyedropper"), glyph: "eyedropper" },
    { id: "text", label: L("Chữ", "Text"), glyph: "text" },
  ];

  const base = "flex size-10 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-30";
  const idle = "text-text-dim-2 hover:bg-white/10 hover:text-text";

  return (
    <div className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto border border-line bg-ink/90 p-1.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-md" data-lenis-prevent>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      {tools.map((tl) => (
        <button
          key={tl.id}
          type="button"
          title={tl.label}
          aria-label={tl.label}
          aria-pressed={state.tool === tl.id}
          onClick={() => actions.setTool(tl.id)}
          className={`${base} ${state.tool === tl.id ? "bg-accent text-ink" : idle}`}
        >
          {GLYPHS[tl.glyph]}
        </button>
      ))}
      <button type="button" title={L("Tải ảnh lên (thành lớp mới)", "Upload image (as a new layer)")} aria-label="upload" onClick={() => fileInputRef.current?.click()} className={`${base} ${idle}`}>
        {GLYPHS.upload}
      </button>

      <span className="mx-1 h-6 w-px bg-line" />

      <label className="flex items-center gap-2 px-2 text-text-dim">
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em]">{L("Cỡ", "Size")}</span>
        <input type="range" min={1} max={200} value={state.brushSize} onChange={(e) => actions.setBrushSize(Number(e.target.value))} className="h-1 w-24 accent-[#ff4d1f]" aria-label="size" />
        <span className="w-7 text-right font-mono-ui text-[11px] text-text">{state.brushSize}</span>
      </label>
      <label className="relative ml-1 size-8 shrink-0 cursor-pointer overflow-hidden border border-line" style={{ backgroundColor: state.color }} title={L("Màu", "Colour")}>
        <input type="color" value={state.color} onChange={(e) => actions.setColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="colour" />
      </label>

      <span className="mx-1 h-6 w-px bg-line" />

      <button type="button" onClick={() => actions.setZoomScale((s) => Math.max(0.5, s - 0.25))} title={L("Thu nhỏ", "Zoom out")} aria-label="zoom out" className={`${base} ${idle}`}>
        {GLYPHS.zoomOut}
      </button>
      <button type="button" onClick={() => actions.setZoomScale((s) => Math.min(3, s + 0.25))} title={L("Phóng to", "Zoom in")} aria-label="zoom in" className={`${base} ${idle}`}>
        {GLYPHS.zoomIn}
      </button>
      {onToggleFullscreen && (
        <button type="button" onClick={onToggleFullscreen} title={L("Toàn màn hình", "Fullscreen")} aria-label="fullscreen" className={`${base} ${idle}`}>
          {isFullscreen ? GLYPHS.exitFull : GLYPHS.full}
        </button>
      )}

      <span className="mx-1 h-6 w-px bg-line" />

      <button type="button" onClick={actions.undo} disabled={!state.canUndo} title={`${L("Hoàn tác", "Undo")} (Ctrl+Z)`} aria-label="undo" className={`${base} ${idle}`}>
        {GLYPHS.undo}
      </button>
      <button type="button" onClick={actions.redo} disabled={!state.canRedo} title={`${L("Làm lại", "Redo")} (Ctrl+Y)`} aria-label="redo" className={`${base} ${idle}`}>
        {GLYPHS.redo}
      </button>
      <button type="button" onClick={actions.clearLayer} title={L("Xóa nội dung lớp đang chọn", "Clear the active layer")} aria-label="clear layer" className={`${base} text-text-dim-2 hover:bg-red-500/20 hover:text-red-400`}>
        {GLYPHS.trash}
      </button>
    </div>
  );
}
