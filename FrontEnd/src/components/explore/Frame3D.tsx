"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

const DEPTH_LAYERS = 16; // number of stacked slices that fake the frame's thickness
const LAYER_GAP = 2; // px between slices

/**
 * A real 3D object made of CSS: the framed painting is extruded by stacking darkened copies behind
 * the front face, then the whole thing sways slowly and leans toward the pointer.
 */
export function Frame3D({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const obj = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = obj.current;
    const host = wrap.current;
    if (!el || !host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(el, { rotateY: -14, rotateX: 4 });
      return;
    }

    // idle sway
    const sway = { y: 0, x: 0 };
    const idle = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "sine.inOut" } });
    idle.fromTo(sway, { y: -20 }, { y: 20, duration: 5.5 }, 0).fromTo(sway, { x: 2 }, { x: 7, duration: 3.6 }, 0);

    // pointer lean (smoothed)
    const lean = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      const r = host.getBoundingClientRect();
      target.y = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 22;
      target.x = (-(e.clientY - (r.top + r.height / 2)) / window.innerHeight) * 12;
    };
    window.addEventListener("mousemove", onMove);

    const tick = () => {
      lean.x += (target.x - lean.x) * 0.06;
      lean.y += (target.y - lean.y) * 0.06;
      gsap.set(el, { rotateY: sway.y + lean.y, rotateX: sway.x + lean.x });
    };
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      gsap.ticker.remove(tick);
      idle.kill();
    };
  }, []);

  return (
    <div ref={wrap} className={`relative ${className}`} style={{ perspective: "1500px" }}>
      {/* contact shadow */}
      <div
        aria-hidden
        className="absolute -bottom-6 left-[8%] right-[8%] h-8 rounded-[50%] bg-black/70 blur-2xl"
      />
      <div ref={obj} className="relative will-change-transform" style={{ transformStyle: "preserve-3d" }}>
        {/* extrusion slices (back to front) */}
        {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
          const z = -(DEPTH_LAYERS - i) * LAYER_GAP;
          const shade = 0.2 + (i / DEPTH_LAYERS) * 0.28;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              aria-hidden
              draggable={false}
              className="absolute inset-0 size-full select-none"
              style={{ transform: `translateZ(${z}px)`, filter: `brightness(${shade}) saturate(0.8)` }}
            />
          );
        })}
        {/* front face */}
        <div className="relative" style={{ transform: "translateZ(0)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} draggable={false} className="block w-full select-none" />
          {/* originality scan, confined to the canvas inside the frame */}
          <div className="scan pointer-events-none absolute overflow-hidden" style={{ left: "19%", right: "19%", top: "17%", bottom: "17%" }} />
        </div>
      </div>
    </div>
  );
}
