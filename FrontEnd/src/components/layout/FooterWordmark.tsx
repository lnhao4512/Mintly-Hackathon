"use client";

/**
 * Giant wordmark. Hovering it turns the small cursor circle into a 2x lens that shows the museum
 * photograph as a plain picture (styling lives on `.cursor-ring.is-lens`, toggled by Cursor).
 */
export function FooterWordmark({ className = "" }: { className?: string }) {
  return (
    <div data-cursor="lens" className={`wordmark select-none ${className}`} aria-label="MINTLY">
      <span aria-hidden className="wordmark-base">MINTLY</span>
    </div>
  );
}
