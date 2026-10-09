"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/** Trailing ring cursor; grows into a filled disc over anything marked [data-cursor] or any link/button. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3" });

    const move = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const hit = (e.target as HTMLElement | null)?.closest("a, button, [data-cursor]");
      el.classList.toggle("is-hover", Boolean(hit));
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", over);
    };
  }, []);

  return <div ref={ref} className="cursor-ring" aria-hidden />;
}
