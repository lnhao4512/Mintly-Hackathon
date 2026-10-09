"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Giant wordmark. Hover it and a soft circle follows the cursor; inside the circle the letters are
 * filled with a painting ("picture inside text"). Pure CSS mask + background-clip:text, driven by two
 * smoothed custom properties.
 */
export function FooterWordmark({ image = "/assets/digital-renaissance.png", className = "" }: { image?: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    el.style.setProperty("--x", "-400px");
    el.style.setProperty("--y", "-400px");
    el.style.setProperty("--r", "0px");
    const x = gsap.quickTo(el, "--x", { duration: 0.5, ease: "power3", unit: "px" } as gsap.TweenVars);
    const y = gsap.quickTo(el, "--y", { duration: 0.5, ease: "power3", unit: "px" } as gsap.TweenVars);

    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      x(e.clientX - r.left);
      y(e.clientY - r.top);
    };
    const enter = () => gsap.to(el, { "--r": "230px", duration: 0.7, ease: "expo.out" } as gsap.TweenVars);
    const leave = () => gsap.to(el, { "--r": "0px", duration: 0.6, ease: "expo.inOut" } as gsap.TweenVars);

    el.addEventListener("mousemove", move);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <div ref={box} data-cursor className={`wordmark relative select-none ${className}`} aria-label="MINTLY">
      <span aria-hidden className="wordmark-base">MINTLY</span>
      <span
        aria-hidden
        className="wordmark-picture"
        style={{ backgroundImage: `url(${image})` }}
      >
        MINTLY
      </span>
    </div>
  );
}
