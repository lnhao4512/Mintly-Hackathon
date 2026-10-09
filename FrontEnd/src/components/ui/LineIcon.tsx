import type { SVGProps } from "react";

export type LineIconName =
  | "shield" | "rocket" | "trophy" | "target" | "palette" | "lock" | "image" | "flame" | "spark"
  | "gem" | "hammer" | "clock" | "crown" | "bolt" | "flag" | "link" | "scroll" | "cross" | "check" | "warning" | "pause";

const PATHS: Record<LineIconName, string> = {
  shield: "M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z M9 12l2 2 4-4",
  rocket: "M12 3c3 2 5 5 5 9l-2 3H9l-2-3c0-4 2-7 5-9z M9 15l-3 3 M15 15l3 3 M12 9.5v.01",
  trophy: "M8 4h8v5a4 4 0 01-8 0V4z M8 6H5v1a3 3 0 003 3 M16 6h3v1a3 3 0 01-3 3 M12 13v4 M9 20h6 M10 17h4",
  target: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z M12 12h.01",
  palette: "M12 3a9 9 0 100 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.5-1-2.6 0-.9.7-1.5 1.6-1.5H17a4 4 0 004-4c0-4.4-4-8.2-9-8.2z M8 11h.01 M11 7.5h.01 M15 8h.01",
  lock: "M6 11h12v9H6v-9z M8.5 11V8a3.5 3.5 0 017 0v3",
  image: "M4 5h16v14H4V5z M4 16l5-5 4 4 3-3 4 4 M9 9.5h.01",
  flame: "M12 3c1 3.5 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2 0-3-.5-5 1-8z",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16z",
  gem: "M6 4h12l4 6-10 11L2 10l4-6z M2 10h20 M9 4l3 6 3-6 M12 21l-3-11 M12 21l3-11",
  hammer: "M14 4l6 6-3 3-6-6 3-3z M12 8L4 16l4 4 8-8 M3 21h7",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  crown: "M4 8l4 4 4-6 4 6 4-4-2 10H6L4 8z",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6l1-7z",
  flag: "M6 21V4 M6 5h11l-2 4 2 4H6",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  scroll: "M7 4h11v13a3 3 0 01-3 3H7a3 3 0 003-3V6a2 2 0 00-3-2z M10 17h8 M11 9h4 M11 12h4",
  cross: "M6 6l12 12 M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  warning: "M12 4l9 16H3L12 4z M12 10v4 M12 17h.01",
  pause: "M8 5v14 M16 5v14",
};

/** Monoline icon in currentColor; replaces the emoji the project used to ship with. */
export function LineIcon({ name, className = "size-4", ...rest }: { name: LineIconName; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
