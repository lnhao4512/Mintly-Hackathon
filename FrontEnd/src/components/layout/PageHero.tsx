"use client";

import type { ReactNode } from "react";
import { FadeUp, LineReveal } from "@/components/motion/Reveal";

/** Shared page header for inner pages: eyebrow, giant headline, lede, actions and a stat strip. */
export function PageHero({
  eyebrow,
  lines,
  description,
  actions,
  stats,
  index,
}: {
  eyebrow: string;
  lines: ReactNode[];
  description?: string;
  actions?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
  index?: string;
}) {
  return (
    <header className="mb-14 md:mb-20">
      <div className="flex items-center justify-between font-mono-ui text-[10px] uppercase tracking-[0.18em] text-text-dim">
        <span className="flex items-center gap-2 text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          {eyebrow}
        </span>
        {index && <span>{index}</span>}
      </div>

      <LineReveal as="h1" lines={lines} className="mega mt-6 text-[clamp(3.2rem,10.5vw,11rem)]" />

      <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
        <FadeUp className="lg:col-span-5">
          {description && <p className="max-w-md text-[15px] leading-relaxed text-text-dim-2">{description}</p>}
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </FadeUp>
        {stats && (
          <FadeUp className="lg:col-span-7 lg:col-start-6" delay={0.1}>
            <dl className="grid grid-cols-3 gap-6 border-t border-line pt-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dd className="font-display text-[clamp(1.3rem,2.4vw,2.2rem)] font-light leading-none tracking-[-0.03em]">{s.value}</dd>
                  <dt className="eyebrow mt-2">{s.label}</dt>
                </div>
              ))}
            </dl>
          </FadeUp>
        )}
      </div>
    </header>
  );
}
