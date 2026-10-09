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
      const target = e.target as HTMLElement | null;
      const lens = Boolean(target?.closest('[data-cursor="lens"]'));
      const img = !lens && Boolean(target?.closest('[data-cursor="img"]'));
      const hit = target?.closest("a, button, [data-cursor]");
      el.classList.toggle("is-lens", lens);
      el.classList.toggle("is-img", img);
      // text and controls keep the inverting disc; pictures never get colour-inverted
      el.classList.toggle("is-hover", !lens && !img && Boolean(hit));
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
