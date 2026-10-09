"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawingActions, DrawingState, LayerBlend, LayerInfo } from "@/hooks/useDrawingCanvas";
import { useI18n } from "@/lib/i18n";

const BLENDS: { id: LayerBlend; vi: string; en: string }[] = [
  { id: "source-over", vi: "Bình thường", en: "Normal" },
  { id: "multiply", vi: "Nhân (đậm)", en: "Multiply" },
  { id: "screen", vi: "Màn hình (sáng)", en: "Screen" },
  { id: "overlay", vi: "Phủ", en: "Overlay" },
  { id: "darken", vi: "Tối hơn", en: "Darken" },
  { id: "lighten", vi: "Sáng hơn", en: "Lighten" },
];

function Thumb({ layer, actions, tick }: { layer: LayerInfo; actions: DrawingActions; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const src = actions.getLayerCanvas(layer.id);
    if (!c || !src) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    // keep the frame's aspect ratio inside the square thumbnail
    const k = Math.min(c.width / src.width, c.height / src.height);
    const dw = src.width * k;
    const dh = src.height * k;
    ctx.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
  }, [layer.id, tick, actions]);
  return (
    <canvas
      ref={ref}
      width={44}
      height={44}
      className="size-11 shrink-0 border border-line bg-[#ece7da] bg-[length:10px_10px]"
      style={{ backgroundImage: "linear-gradient(45deg,#d8d2c4 25%,transparent 25%,transparent 75%,#d8d2c4 75%),linear-gradient(45deg,#d8d2c4 25%,transparent 25%,transparent 75%,#d8d2c4 75%)", backgroundPosition: "0 0,5px 5px" }}
    />
  );
}

const Icon = ({ d, label }: { d: string; label: string }) => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-label={label}>
    <path d={d} />
  </svg>
);

export function LayersPanel({ state, actions }: { state: DrawingState; actions: DrawingActions }) {
  const { L, locale } = useI18n();
  const [editing, setEditing] = useState<string | null>(null);
  const ordered = [...state.layers].reverse(); // top layer first
  const active = state.layers.find((l) => l.id === state.activeLayerId);
  const activeIndex = state.layers.findIndex((l) => l.id === state.activeLayerId);

  const btn = "flex size-8 items-center justify-center border border-line text-text-dim-2 transition-colors hover:border-text hover:text-text disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">{L("Lớp", "Layers")} · {state.layers.length}</p>
        <div className="flex gap-1.5">
          <button type="button" className={btn} onClick={actions.addLayer} title={L("Thêm lớp", "Add layer")}>
            <Icon label="add" d="M12 5v14M5 12h14" />
          </button>
          <button type="button" className={btn} onClick={() => active && actions.duplicateLayer(active.id)} title={L("Nhân bản lớp", "Duplicate layer")}>
            <Icon label="duplicate" d="M9 9h10v10H9zM5 15V5h10" />
          </button>
          <button type="button" className={btn} disabled={activeIndex <= 0} onClick={() => active && actions.mergeDown(active.id)} title={L("Gộp xuống lớp dưới", "Merge down")}>
            <Icon label="merge" d="M12 4v10m0 0-4-4m4 4 4-4M5 20h14" />
          </button>
          <button type="button" className={`${btn} hover:!border-red-400 hover:!text-red-400`} onClick={() => active && actions.deleteLayer(active.id)} title={L("Xóa lớp", "Delete layer")}>
            <Icon label="delete" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
          </button>
        </div>
      </div>

      <ul className="flex max-h-[300px] flex-col gap-1.5 overflow-y-auto pr-1" data-lenis-prevent>
        {ordered.map((l) => {
          const isActive = l.id === state.activeLayerId;
          return (
            <li
              key={l.id}
              onClick={() => actions.setActiveLayer(l.id)}
              className={`flex cursor-pointer items-center gap-2.5 border p-1.5 transition-colors ${isActive ? "border-accent bg-accent/10" : "border-line hover:border-text-dim"}`}
            >
              <button
                type="button"
                aria-label={l.visible ? L("Ẩn lớp", "Hide layer") : L("Hiện lớp", "Show layer")}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.toggleLayerVisible(l.id);
                }}
                className={`flex size-7 shrink-0 items-center justify-center ${l.visible ? "text-text" : "text-text-dim/50"}`}
              >
                {l.visible ? (
                  <Icon label="visible" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                ) : (
                  <Icon label="hidden" d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.2 7.6A17 17 0 0 0 2 12s4 7 10 7a9.5 9.5 0 0 0 4-.9" />
                )}
              </button>
              <Thumb layer={l} actions={actions} tick={state.thumbTick} />
              <div className="min-w-0 flex-1">
                {editing === l.id ? (
                  <input
                    autoFocus
                    defaultValue={l.name}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      actions.renameLayer(l.id, e.target.value);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full border-b border-accent bg-transparent text-sm text-text outline-none"
                  />
                ) : (
                  <p
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditing(l.id);
                    }}
                    title={L("Nhấp đúp để đổi tên", "Double-click to rename")}
                    className="truncate text-sm text-text"
                  >
                    {l.name}
                  </p>
                )}
                <p className="font-mono-ui text-[10px] uppercase tracking-[0.12em] text-text-dim">
                  {Math.round(l.opacity * 100)}% · {(BLENDS.find((b) => b.id === l.blend) ?? BLENDS[0])[locale === "vi" ? "vi" : "en"]}
                </p>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="up"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.moveLayer(l.id, 1);
                  }}
                  className="text-text-dim hover:text-text"
                >
                  <Icon label="up" d="m6 14 6-6 6 6" />
                </button>
                <button
                  type="button"
                  aria-label="down"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.moveLayer(l.id, -1);
                  }}
                  className="text-text-dim hover:text-text"
                >
                  <Icon label="down" d="m6 10 6 6 6-6" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {active && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <label className="flex flex-col gap-2">
            <span className="flex justify-between eyebrow">
              <span>{L("Độ mờ lớp", "Layer opacity")}</span>
              <span className="text-text">{Math.round(active.opacity * 100)}%</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(active.opacity * 100)} onChange={(e) => actions.setLayerOpacity(active.id, Number(e.target.value) / 100)} className="h-1 w-full accent-[#ff4d1f]" />
          </label>
          <label className="flex flex-col gap-2">
            <span className="eyebrow">{L("Chế độ hòa trộn", "Blend mode")}</span>
            <select
              value={active.blend}
              onChange={(e) => actions.setLayerBlend(active.id, e.target.value as LayerBlend)}
              className="border border-line bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
            >
              {BLENDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === "vi" ? b.vi : b.en}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
