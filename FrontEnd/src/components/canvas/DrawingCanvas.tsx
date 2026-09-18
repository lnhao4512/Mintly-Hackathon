"use client";

import { useRef } from "react";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import { CanvasToolbar } from "./CanvasToolbar";

interface DrawingCanvasProps {
  /** Called whenever the drawing state changes — parent can track dirty state */
  onStateChange?: (dirty: boolean) => void;
}

/**
 * Full-featured drawing canvas with floating toolbar.
 *
 * Renders an HTML5 `<canvas>` inside a white art-board with a subtle
 * grid background, matching the existing MINTLY `/create` page layout.
 *
 * The `exportToPng` method is exposed via the returned actions from
 * `useDrawingCanvas` — the parent page accesses it through the hook.
 */
export function DrawingCanvas({}: DrawingCanvasProps = {}) {
  // TODO: Optimize mobile canvas layout and touch events later
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, actions, handlers } = useDrawingCanvas(canvasRef);

  // Dynamic cursor showing brush size
  const cursorSize = Math.max(4, state.brushSize);
  const cursorStyle =
    state.tool === "eraser"
      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}'%3E%3Ccircle cx='${cursorSize / 2}' cy='${cursorSize / 2}' r='${cursorSize / 2 - 1}' fill='none' stroke='%23888' stroke-width='1' stroke-dasharray='3,2'/%3E%3C/svg%3E") ${cursorSize / 2} ${cursorSize / 2}, crosshair`
      : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}'%3E%3Ccircle cx='${cursorSize / 2}' cy='${cursorSize / 2}' r='${cursorSize / 2 - 1}' fill='none' stroke='%23555' stroke-width='1'/%3E%3C/svg%3E") ${cursorSize / 2} ${cursorSize / 2}, crosshair`;

  return (
    <section className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line-subtle bg-[#f8f8f8] shadow-[inset_0_2px_4px_1px_rgba(0,0,0,0.05)]">
      {/* Grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Canvas artboard */}
      <div className="relative aspect-[4/3] w-[min(800px,90%)] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.35)]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full"
          style={{ cursor: cursorStyle, touchAction: "none" }}
          {...handlers}
        />
      </div>

      {/* Canvas status pill */}
      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full border border-line-glass bg-[rgba(34,34,34,0.55)] px-4 py-2 backdrop-blur-md">
        <span className="size-2 rounded-full bg-[#e3e2e1]" />
        <span className="eyebrow">Draft · Ready to draw</span>
      </div>

      {/* Floating toolbar */}
      <CanvasToolbar state={state} actions={actions} />
    </section>
  );
}

// Re-export the hook so the parent page can also access canvas actions
export { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
