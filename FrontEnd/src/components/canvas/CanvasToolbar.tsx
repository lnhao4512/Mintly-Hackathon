"use client";

import { useRef, type ChangeEvent } from "react";
import type { DrawingState, DrawingActions } from "@/hooks/useDrawingCanvas";
import { useI18n } from "@/lib/i18n";

/* — Small toolbar glyphs — */
function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13.5 6.5 17.5 10.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EraserGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M8 20h11M4.5 15.5 11 9l5 5-4.5 4.5a2 2 0 0 1-2.8 0L4.5 15.5a2 2 0 0 1 0-2.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function EyedropGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="m14 6 4 4M13 7 5 15v4h4l8-8M16 4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PixelGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z" />
    </svg>
  );
}

function TextGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M4 6.5h16M4 11.5h10M4 16.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 18.5h4v-5h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FillGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M5 10.5 12 3l7 7.5v7.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 12V3m0 0L8 7m4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomInGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomOutGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 21l-4.35-4.35M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullscreenGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExitFullscreenGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SWATCHES = [
  "#141313",
  "#ff8ab6",
  "#65e0ff",
  "#8ef7c0",
  "#ffb86b",
  "#c7b7ff",
  "#ff4757",
  "#ffffff",
  "#2ed573",
  "#1e90ff",
  "#ffa502",
  "#9c88ff",
];

interface CanvasToolbarProps {
  state: DrawingState;
  actions: DrawingActions;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/**
 * Floating toolbar for the Canvas Studio.
 *
 * Refactored to a more Minimalist / Gen-Z layout featuring
 * tool grouping, zoom controls, eyedropper, and fullscreen support.
 */
export function CanvasToolbar({
  state,
  actions,
  isFullscreen,
  onToggleFullscreen,
}: CanvasToolbarProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await actions.loadImage(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[36px] border border-[rgba(255,255,255,0.15)] bg-[linear-gradient(135deg,rgba(26,26,26,0.92),rgba(20,20,20,0.88))] p-3 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl" style={{
      background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.92), rgba(20, 20, 20, 0.88))',
      boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      {/* Tools Group */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => actions.setTool("pencil")}
          aria-label={t("tool.pencil")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.tool === "pencil"
              ? "bg-gradient-to-r from-[#ff8ab6] to-[#ffa8c8] text-[#0a0a0a] shadow-[0_0_20px_rgba(255,138,182,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <PencilGlyph />
        </button>
        <button
          onClick={() => actions.setTool("eraser")}
          aria-label={t("tool.eraser")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.tool === "eraser"
              ? "bg-gradient-to-r from-[#c7b7ff] to-[#dcc8ff] text-[#0a0a0a] shadow-[0_0_20px_rgba(199,183,255,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <EraserGlyph />
        </button>
        <button
          onClick={() => actions.setTool("text")}
          aria-label={t("tool.text")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.tool === "text"
              ? "bg-gradient-to-r from-[#8ef7c0] to-[#a3ffc8] text-[#0a0a0a] shadow-[0_0_20px_rgba(142,247,192,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <TextGlyph />
        </button>
        <button
          onClick={() => actions.setTool("fill")}
          aria-label={t("tool.fill")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.tool === "fill"
              ? "bg-gradient-to-r from-[#65e0ff] to-[#88ebff] text-[#0a0a0a] shadow-[0_0_20px_rgba(101,224,255,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <FillGlyph />
        </button>
        <button
          onClick={() => actions.setTool("eyedropper")}
          aria-label={t("tool.eyedropper")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.tool === "eyedropper"
              ? "bg-gradient-to-r from-[#ffb86b] to-[#ffc688] text-[#0a0a0a] shadow-[0_0_20px_rgba(255,184,107,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <EyedropGlyph />
        </button>
        <button
          onClick={() => actions.setPixelMode(!state.isPixelMode)}
          aria-label={t("tool.pixel")}
          title={t("tool.pixel")}
          className={`flex size-11 items-center justify-center rounded-full transition-all ${
            state.isPixelMode
              ? "bg-gradient-to-r from-[#ffd4a8] to-[#ffe4c8] text-[#0a0a0a] shadow-[0_0_20px_rgba(255,212,168,0.6)]"
              : "text-text-dim hover:bg-white/5 hover:text-text"
          }`}
        >
          <PixelGlyph />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("tool.upload")}
          title={t("tool.upload")}
          className="flex size-11 items-center justify-center rounded-full text-text-dim transition-all hover:bg-accent/20 hover:text-accent hover:shadow-[0_0_20px_rgba(184,165,255,0.6)]"
        >
          <UploadGlyph />
        </button>
      </div>

      <span className="mx-1 h-7 w-px bg-white/10" />

      {/* Text input + brush size */}
      <div className="flex items-center gap-2 px-2">
        <input
          value={state.textValue}
          onChange={(e) => actions.setTextValue(e.target.value)}
          placeholder={t("tool.text")}
          className="w-24 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-text outline-none placeholder:text-text-dim focus:border-[#ff8ab6] focus:bg-white/8 transition-all"
        />
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-dim">{t("tool.size")}</span>
          <input
            type="range"
            min={2}
            max={60}
            step={1}
            value={state.brushSize}
            onChange={(e) => actions.setBrushSize(Number(e.target.value))}
            className="h-1.5 w-20 accent-[#ff8ab6]"
            aria-label={t("tool.size")}
          />
          <span className="min-w-4 text-center text-[10px] font-semibold text-text">{state.brushSize}</span>
        </div>
      </div>

      <span className="mx-1 h-7 w-px bg-white/10" />

      {/* Colors & Size */}
      <div className="flex items-center gap-1.5 px-2">
        {SWATCHES.slice(0, 8).map((c) => (
          <button
            key={c}
            onClick={() => actions.setColor(c)}
            aria-label={`Color ${c}`}
            className="size-7 rounded-full border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: state.color === c ? "#ffffff" : "transparent",
              boxShadow: state.color === c ? `0 0 12px ${c}88` : "none",
            }}
          />
        ))}

        {/* Custom color picker */}
        <label
          className="relative ml-1 flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-white/30 transition-colors hover:border-white/60"
          aria-label={t("tool.customColor")}
        >
          <div className="size-3.5 rounded-full" style={{ backgroundColor: state.color }} />
          <input
            type="color"
            value={state.color}
            onChange={(e) => actions.setColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>

      <span className="mx-1 h-7 w-px bg-white/10" />

      {/* View Group (Zoom + Fullscreen) */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => actions.setZoomScale((s) => Math.max(0.5, s - 0.25))}
          aria-label={t("tool.zoomOut")}
          className="flex size-11 items-center justify-center rounded-full text-text-dim transition-all hover:bg-white/5 hover:text-text"
        >
          <ZoomOutGlyph />
        </button>
        <button
          onClick={() => actions.setZoomScale((s) => Math.min(3, s + 0.25))}
          aria-label={t("tool.zoomIn")}
          className="flex size-11 items-center justify-center rounded-full text-text-dim transition-all hover:bg-white/5 hover:text-text"
        >
          <ZoomInGlyph />
        </button>
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            aria-label={t("tool.fullscreen")}
            className="flex size-10 items-center justify-center rounded-full text-text-dim hover:bg-white/5 hover:text-text"
          >
            {isFullscreen ? <ExitFullscreenGlyph /> : <FullscreenGlyph />}
          </button>
        )}
      </div>

      <span className="mx-2 h-6 w-px bg-white/10" />

      {/* History Group */}
      <div className="flex items-center gap-1">
        <button
          onClick={actions.undo}
          disabled={!state.canUndo}
          aria-label={t("tool.undo")}
          className="flex size-10 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30 disabled:pointer-events-none"
        >
          <UndoGlyph />
        </button>
        <button
          onClick={actions.redo}
          disabled={!state.canRedo}
          aria-label={t("tool.redo")}
          className="flex size-10 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-white/5 hover:text-text disabled:opacity-30 disabled:pointer-events-none"
        >
          <RedoGlyph />
        </button>
        <button
          onClick={actions.clear}
          aria-label={t("tool.clear")}
          className="flex size-10 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-red-500/20 hover:text-red-400"
        >
          <TrashGlyph />
        </button>
      </div>

    </div>
  );
}
