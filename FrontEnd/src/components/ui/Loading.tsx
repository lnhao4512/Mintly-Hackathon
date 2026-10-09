"use client";

import type { CSSProperties } from "react";

/**
 * Processing indicator: a row of bars that "draw" up and down, with a shimmering caption.
 * Use it wherever data is being fetched so an empty screen is never mistaken for "no data".
 */
export function Loading({ label, className = "", compact = false }: { label?: string; className?: string; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-4 ${compact ? "" : "py-16"} ${className}`}>
      <span className="flex h-6 items-end gap-[3px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="loader-bar w-[3px] bg-accent" style={{ "--i": i } as CSSProperties} />
        ))}
      </span>
      {label && <span className="shimmer-text font-display text-2xl font-light italic tracking-[-0.02em]">{label}</span>}
    </div>
  );
}

/** Shimmering placeholder for a number / short text while it loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton inline-block align-middle ${className}`} />;
}
