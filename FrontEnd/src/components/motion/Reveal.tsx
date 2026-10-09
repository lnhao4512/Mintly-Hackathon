"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";

/** Adds `is-in` to the element once it enters the viewport (with a hard fallback so nothing stays hidden). */
export function useInView<T extends HTMLElement>(options: { threshold?: number; rootMargin?: string } = {}) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("is-in");
    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { threshold: options.threshold ?? 0.05, rootMargin: options.rootMargin ?? "0px 0px -8% 0px" }
    );
    io.observe(el);
    const fallback = window.setTimeout(show, 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [options.threshold, options.rootMargin]);
  return ref;
}

/**
 * Headline split into lines that rise out of a mask. `lines` are provided explicitly so we control
 * the typographic rhythm. Pure CSS transition triggered by IntersectionObserver — cannot get stuck mid-way.
 */
export function LineReveal({
  lines,
  as: Tag = "h2",
  className = "",
  delay = 0,
  stagger = 0.11,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={className} style={{ "--d": `${delay}s` } as CSSProperties}>
      {lines.map((line, i) => (
        <span key={i} className="mask">
          <span className="mask-inner" style={{ "--i": i * (stagger / 0.11) } as CSSProperties}>
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/** Fade + rise for blocks. */
export function FadeUp({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={`fade-up ${className}`} style={{ "--d": `${delay}s` } as CSSProperties}>
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
