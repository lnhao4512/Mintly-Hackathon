"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";

/**
 * Headline split into lines that rise out of a mask. `lines` are provided explicitly so we control
 * the typographic rhythm (no brittle DOM measuring). Plays when scrolled into view.
 */
export function LineReveal({
  lines,
  as: Tag = "h2",
  className = "",
  delay = 0,
  stagger = 0.09,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inners = el.querySelectorAll<HTMLElement>(".mask-inner");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      gsap.set(inners, { yPercent: 0, rotate: 0 });
      return;
    }
    gsap.set(inners, { yPercent: 110, rotate: 3 });
    const tween = gsap.to(inners, {
      yPercent: 0,
      rotate: 0,
      duration: 1.25,
      ease: "expo.out",
      stagger,
      delay,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, stagger]);

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="mask">
          {/* starts hidden in the SSR markup so there is no flash before GSAP takes over */}
          <span className="mask-inner" style={{ transform: "translateY(110%)" }}>
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/** Fade + rise for blocks. */
export function FadeUp({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el, { y: 0, opacity: 1 });
      return;
    }
    gsap.set(el, { y: 40, opacity: 0 });
    const tween = gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 1.1,
      delay,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay]);
  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

/** Scroll-linked vertical drift. speed < 0 moves against the scroll (feels deeper). */
export function Parallax({ children, speed = 0.15, className = "" }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      el,
      { y: () => -speed * 300 },
      {
        y: () => speed * 300,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [speed]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Marquee of repeated items. */
export function Marquee({ items, className = "", reverse = false }: { items: ReactNode[]; className?: string; reverse?: boolean }) {
  const track = (key: string) => (
    <div className="marquee-track" key={key} aria-hidden={key === "b"}>
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-12">
          {item}
        </span>
      ))}
    </div>
  );
  return (
    <div className={`marquee ${reverse ? "reverse" : ""} ${className}`}>
      {track("a")}
      {track("b")}
    </div>
  );
}
