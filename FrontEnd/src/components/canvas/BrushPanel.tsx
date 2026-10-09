"use client";

import { useEffect, useRef } from "react";
import type { DrawingActions, DrawingState } from "@/hooks/useDrawingCanvas";
import { BRUSHES, renderBrushPreview, type BrushDef } from "@/lib/paint/brushes";
import { useI18n } from "@/lib/i18n";

const SWATCHES = ["#0a0a09", "#ffffff", "#ff4d1f", "#ffb340", "#f2d24a", "#c8ff3d", "#2ed573", "#1e90ff", "#3a3ad6", "#9c5fe0", "#e0529c", "#7a4a2b"];

function BrushCard({ brush, color, active, onPick, label, desc }: { brush: BrushDef; color: string; active: boolean; onPick: () => void; label: string; desc: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // dark ink on light strip would vanish on the dark panel, so previews always use a visible colour
    renderBrushPreview(c, brush, color);
  }, [brush, color]);
  return (
    <button
      type="button"
      onClick={onPick}
      title={desc}
      className={`group flex flex-col gap-1 border p-2 text-left transition-colors ${
        active ? "border-accent bg-accent/10" : "border-line hover:border-text-dim"
      }`}
    >
      <canvas ref={ref} width={150} height={44} className="h-11 w-full rounded-[2px] bg-[#ece7da]" />
      <span className={`font-mono-ui text-[10px] uppercase tracking-[0.14em] ${active ? "text-accent" : "text-text-dim-2"}`}>{label}</span>
    </button>
  );
}

export function BrushPanel({ state, actions }: { state: DrawingState; actions: DrawingActions }) {
  const { L, locale } = useI18n();
  // previews use a mid-tone so every brush reads on the light strip
  const previewColor = state.color.toLowerCase() === "#ffffff" ? "#141313" : state.color;
  const usingBrush = state.tool === "brush";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="eyebrow mb-3">{L("Thư viện cọ", "Brush library")}</p>
        <div className="grid grid-cols-2 gap-2">
          {BRUSHES.map((b) => (
            <BrushCard
              key={b.id}
              brush={b}
              color={previewColor}
              active={usingBrush && state.brushId === b.id}
              onPick={() => actions.setBrushId(b.id)}
              label={locale === "vi" ? b.vi : b.en}
              desc={locale === "vi" ? b.descVi : b.descEn}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="flex justify-between eyebrow">
            <span>{L("Cỡ cọ", "Size")}</span>
            <span className="text-text">{state.brushSize}px</span>
          </span>
          <input type="range" min={1} max={200} value={state.brushSize} onChange={(e) => actions.setBrushSize(Number(e.target.value))} className="h-1 w-full accent-[#ff4d1f]" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="flex justify-between eyebrow">
            <span>{L("Độ đậm", "Opacity")}</span>
            <span className="text-text">{Math.round(state.opacity * 100)}%</span>
          </span>
          <input type="range" min={5} max={100} value={Math.round(state.opacity * 100)} onChange={(e) => actions.setOpacity(Number(e.target.value) / 100)} className="h-1 w-full accent-[#ff4d1f]" />
        </label>
      </section>

      <section>
        <p className="eyebrow mb-3">{L("Màu", "Colour")}</p>
        <div className="flex items-center gap-3">
          <label className="relative size-12 shrink-0 cursor-pointer overflow-hidden border border-line" style={{ backgroundColor: state.color }}>
            <input type="color" value={state.color} onChange={(e) => actions.setColor(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={L("Chọn màu", "Pick a colour")} />
          </label>
          <input
            value={state.color}
            onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && actions.setColor(e.target.value)}
            spellCheck={false}
            className="w-28 border-b border-line bg-transparent pb-1 font-mono text-sm uppercase text-text outline-none focus:border-accent"
          />
        </div>
        <div className="mt-3 grid grid-cols-6 gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => actions.setColor(c)}
              className={`aspect-square border transition-transform hover:scale-110 ${state.color.toLowerCase() === c ? "border-text" : "border-line"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        {state.recentColors.length > 0 && (
          <div className="mt-3">
            <p className="eyebrow mb-2">{L("Vừa dùng", "Recent")}</p>
            <div className="flex flex-wrap gap-1.5">
              {state.recentColors.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => actions.setColor(c)} className="size-6 border border-line hover:scale-110" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
