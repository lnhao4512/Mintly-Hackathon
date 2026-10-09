"use client";

import { useEffect, useState } from "react";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE, type DrawingActions, type DrawingState } from "@/hooks/useDrawingCanvas";
import { useI18n } from "@/lib/i18n";

const PRESETS: { w: number; h: number; vi: string; en: string }[] = [
  { w: 1080, h: 1080, vi: "Vuông 1:1", en: "Square 1:1" },
  { w: 1080, h: 1350, vi: "Dọc 4:5", en: "Portrait 4:5" },
  { w: 1080, h: 1620, vi: "Dọc 2:3", en: "Portrait 2:3" },
  { w: 1080, h: 1920, vi: "Dọc 9:16", en: "Tall 9:16" },
  { w: 1350, h: 1080, vi: "Ngang 5:4", en: "Landscape 5:4" },
  { w: 1620, h: 1080, vi: "Ngang 3:2", en: "Landscape 3:2" },
  { w: 1920, h: 1080, vi: "Ngang 16:9", en: "Wide 16:9" },
];

/** Artboard size: presets plus free width/height. Artwork stays centred when the frame changes. */
export function FramePanel({ state, actions }: { state: DrawingState; actions: DrawingActions }) {
  const { L } = useI18n();
  const { w, h } = state.canvasSize;
  const [wIn, setWIn] = useState(String(w));
  const [hIn, setHIn] = useState(String(h));

  useEffect(() => {
    setWIn(String(w));
    setHIn(String(h));
  }, [w, h]);

  const apply = (nw: number, nh: number) => {
    if (nw === w && nh === h) return;
    const hasContent = state.canUndo || state.isDirty;
    if (
      hasContent &&
      !window.confirm(
        L(
          "Đổi kích thước khung sẽ căn giữa nét vẽ (có thể bị cắt ở mép) và xóa lịch sử hoàn tác. Tiếp tục?",
          "Resizing the frame centres your artwork (edges may be cropped) and clears the undo history. Continue?"
        )
      )
    ) {
      setWIn(String(w));
      setHIn(String(h));
      return;
    }
    actions.setCanvasSize(nw, nh);
  };

  const parsed = (v: string) => Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(Number(v)) || 0));
  const valid = Number(wIn) >= MIN_CANVAS_SIZE && Number(hIn) >= MIN_CANVAS_SIZE;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="eyebrow">{L("Khung tranh", "Frame")}</h3>
        <span className="font-mono-ui text-[10px] text-text-dim">{w} × {h}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((p) => {
          const active = p.w === w && p.h === h;
          return (
            <button
              key={`${p.w}x${p.h}`}
              type="button"
              onClick={() => apply(p.w, p.h)}
              className={`border px-2 py-2 text-left font-mono-ui text-[10px] uppercase tracking-[0.1em] transition-colors ${
                active ? "border-accent text-accent" : "border-line text-text-dim hover:border-text hover:text-text"
              }`}
            >
              {L(p.vi, p.en)}
            </button>
          );
        })}
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 font-mono-ui text-[10px] uppercase tracking-[0.1em] text-text-dim">
          {L("Rộng", "Width")}
          <input
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={wIn}
            onChange={(e) => setWIn(e.target.value)}
            className="w-full border border-line bg-transparent px-2 py-1.5 text-sm normal-case tracking-normal text-text outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 font-mono-ui text-[10px] uppercase tracking-[0.1em] text-text-dim">
          {L("Cao", "Height")}
          <input
            type="number"
            inputMode="numeric"
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            value={hIn}
            onChange={(e) => setHIn(e.target.value)}
            className="w-full border border-line bg-transparent px-2 py-1.5 text-sm normal-case tracking-normal text-text outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          disabled={!valid}
          onClick={() => apply(parsed(wIn), parsed(hIn))}
          className="border border-line px-3 py-1.5 font-mono-ui text-[10px] uppercase tracking-[0.1em] text-text transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {L("Áp dụng", "Apply")}
        </button>
      </div>
      <p className="text-[11px] leading-5 text-text-dim">
        {L(`Từ ${MIN_CANVAS_SIZE} đến ${MAX_CANVAS_SIZE} px mỗi cạnh.`, `${MIN_CANVAS_SIZE} to ${MAX_CANVAS_SIZE} px per side.`)}
      </p>
    </section>
  );
}
