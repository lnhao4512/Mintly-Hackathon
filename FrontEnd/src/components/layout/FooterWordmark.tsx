"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Giant wordmark. A small disc follows the cursor over it; hovering grows the disc 2x, and the
 * letters inside the disc turn into the museum photograph (picture inside text). The disc, the
 * picture mask and the cursor ring are all driven by the same two smoothed coordinates.
 */
export function FooterWordmark({ image = "/museum.jpg", className = "" }: { image?: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;
    el.style.setProperty("--x", "-400px");
    el.style.setProperty("--y", "-400px");
    el.style.setProperty("--r", "0px");
    const x = gsap.quickTo(el, "--x", { duration: 0.45, ease: "power3", unit: "px" } as gsap.TweenVars);
    const y = gsap.quickTo(el, "--y", { duration: 0.45, ease: "power3", unit: "px" } as gsap.TweenVars);

    let entered = false;
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      if (!entered) {
        entered = true;
        // start exactly under the pointer as a small disc, then grow to 2x
        gsap.set(el, { "--x": `${px}px`, "--y": `${py}px`, "--r": "18px" } as gsap.TweenVars);
        gsap.to(el, { "--r": "84px", duration: 0.55, ease: "expo.out" } as gsap.TweenVars);
      }
      x(px);
      y(py);
    };
    const leave = () => {
      entered = false;
      gsap.to(el, { "--r": "0px", duration: 0.3, ease: "expo.inOut" } as gsap.TweenVars);
    };

    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    return () => {
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
    };
  }, []);

  return (
    <div ref={box} data-cursor="lens" className={`wordmark select-none ${className}`} aria-label="MINTLY">
      <span aria-hidden className="wordmark-base">MINTLY</span>
      <span aria-hidden className="wordmark-disc" />
      <span aria-hidden className="wordmark-picture" style={{ backgroundImage: `url(${image})` }}>
        MINTLY
      </span>
    </div>
  );
}
