"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useI18n } from "@/lib/i18n";

/** Small, purposeful diagrams for the 4 steps (draw / prove / auction / settle). */
export function ProcessVisual({ step }: { step: 0 | 1 | 2 | 3 }) {
  const { L } = useI18n();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      if (step === 0) {
        const path = el.querySelector<SVGPathElement>("path");
        if (path) {
          const len = path.getTotalLength();
          gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(path, { strokeDashoffset: 0, duration: 4.5, ease: "power2.inOut", repeat: -1, repeatDelay: 1.2, yoyo: false });
        }
      }
      if (step === 2) {
        gsap.fromTo("[data-bar]", { scaleY: 0 }, { scaleY: 1, duration: 1.2, ease: "expo.out", stagger: 0.18, repeat: -1, repeatDelay: 2.2 });
      }
      if (step === 3) {
        gsap.fromTo("[data-split]", { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: "expo.out", stagger: 0.25, repeat: -1, repeatDelay: 2.6 });
      }
    }, el);
    return () => ctx.revert();
  }, [step]);

  return (
    <div ref={root} className="w-full max-w-[460px] text-text-dim-2" aria-hidden>
      {step === 0 && (
        <svg viewBox="0 0 460 260" fill="none" className="w-full">
          <rect x="0.5" y="0.5" width="459" height="259" stroke="currentColor" strokeOpacity="0.2" />
          <path
            d="M30 190 C 70 40, 120 40, 150 130 S 220 230, 260 110 S 330 20, 360 120 S 410 200, 432 70"
            stroke="#ff4d1f"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text x="16" y="248" fontSize="10" fill="currentColor" fontFamily="var(--font-sans)" letterSpacing="2">
            {L("NÉT 0482", "STROKE 0482")} · 00:14:07
          </text>
        </svg>
      )}
      {step === 1 && (
        <div className="space-y-2 border border-line p-5 font-mono text-[11px] leading-relaxed">
          <p className="text-text-dim">{L("SHA-256 · dữ liệu quá trình vẽ", "SHA-256 · creation trace")}</p>
          <p className="break-all text-text">9f2c4e1a b7d03a65 c81e9d42 5a60f7b3</p>
          <p className="text-text-dim">{L("SPL Memo · giao dịch mint", "SPL Memo · mint tx")}</p>
          <p className="break-all text-text">MINTLY:proof:v1:7Qx…k2:drawn:9f2c…f7b3</p>
          <p className="pt-2 text-success">{L("khớp Memo on-chain", "trace matches memo on-chain")}</p>
        </div>
      )}
      {step === 2 && (
        <div className="flex h-[260px] items-end gap-3 border border-line p-5">
          {[28, 38, 52, 64, 80, 100].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
              <div data-bar className="origin-bottom bg-text/80 data-[last=true]:bg-accent" data-last={i === 5} style={{ height: `${h}%` }} />
              <span className="mt-2 font-mono-ui text-[9px] text-text-dim">{(0.5 + i * 0.25).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      {step === 3 && (
        <div className="space-y-6 border border-line p-5 font-mono-ui text-[10px] uppercase tracking-[0.14em]">
          <div>
            <p className="mb-2 text-text-dim">{L("Người thắng trả → NFT chuyển", "Winner pays → NFT moves")}</p>
            <div className="h-3 w-full bg-line"><div data-split className="h-full origin-left bg-text" /></div>
          </div>
          <div>
            <p className="mb-2 text-text-dim">{L("Nếu bùng kèo · chia tiền cọc", "If they walk away · deposit split")}</p>
            <div className="flex h-3 w-full origin-left">
              <div data-split className="h-full origin-left bg-accent" style={{ width: "70%" }} />
              <div data-split className="h-full origin-left bg-text-dim" style={{ width: "30%" }} />
            </div>
            <div className="mt-2 flex justify-between text-text-dim-2">
              <span>{L("70% nghệ sĩ", "70% artist")}</span>
              <span>{L("30% sàn", "30% platform")}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
