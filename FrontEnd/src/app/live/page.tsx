"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/layout/PageHero";
import { useI18n } from "@/lib/i18n";

interface Session {
  creator: string;
  title: string;
  startedAt: number;
}

export default function LiveIndexPage() {
  const { L } = useI18n();
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/live");
        const data = (await res.json()) as { sessions: Session[] };
        if (active) setSessions(data.sessions ?? []);
      } catch {
        if (active) setSessions([]);
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <PageHero
          eyebrow={L("Trực tiếp", "Live")}
          index={L("04 / Trực tiếp", "04 / Live")}
          lines={[L("Vẽ", "Drawing"), <em key="n">{L("trực tiếp", "now")}</em>]}
          description={L("Xem nghệ sĩ vẽ theo thời gian thực. Khi tác phẩm xong, đặt giá ngay trong phiên đấu giá của họ.", "Watch artists draw in realtime. When the piece is done, bid in their auction right away.")}
        />
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {sessions === null && <p className="bg-bg p-8 text-text-dim">{L("Đang tải...", "Loading...")}</p>}
          {sessions?.length === 0 && <p className="bg-bg p-8 text-text-dim-2 sm:col-span-2 lg:col-span-3">{L("Hiện chưa có ai phát trực tiếp. Vào Studio và bấm \u201cPhát trực tiếp\u201d để bắt đầu.", "Nobody is live right now. Open the Studio and press \u201cGo live\u201d to start.")}</p>}
          {sessions?.map((s) => (
            <Link key={s.creator} href={`/live/${s.creator}`} data-cursor className="group bg-bg p-8 transition-colors hover:bg-bg-elevated">
              <span className="inline-flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-accent">
                <span className="size-1.5 animate-pulse rounded-full bg-accent" /> Live
              </span>
              <p className="mt-6 font-display text-3xl font-light tracking-[-0.03em] transition-colors group-hover:text-accent">{s.title}</p>
              <p className="mt-2 font-mono-ui text-[11px] text-text-dim">{s.creator.slice(0, 6)}…{s.creator.slice(-6)}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
