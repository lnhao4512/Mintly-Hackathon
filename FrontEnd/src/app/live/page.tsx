"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface Session {
  creator: string;
  title: string;
  startedAt: number;
}

export default function LiveIndexPage() {
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
    <div className="min-h-screen bg-[#0a0b0d] text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[900px] px-5 pb-24 pt-32 sm:px-8">
        <p className="eyebrow text-accent-strong">MINTLY / LIVE</p>
        <h1 className="mt-3 font-display text-5xl sm:text-6xl">Đang vẽ trực tiếp</h1>
        <p className="mt-4 max-w-2xl text-text-dim">Xem nghệ sĩ vẽ theo thời gian thực. Khi tác phẩm xong, đặt giá ngay trong phiên đấu giá của họ.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {sessions === null && <p className="text-text-dim">Đang tải...</p>}
          {sessions?.length === 0 && <p className="text-text-dim">Hiện chưa có ai phát trực tiếp. Vào Studio và bấm &quot;Phát trực tiếp&quot; để bắt đầu.</p>}
          {sessions?.map((s) => (
            <Link key={s.creator} href={`/live/${s.creator}`} className="glass-panel rounded-2xl p-5 transition-transform hover:-translate-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300">
                <span className="size-2 animate-pulse rounded-full bg-red-400" /> LIVE
              </span>
              <p className="mt-2 font-display text-2xl">{s.title}</p>
              <p className="mt-1 font-mono text-xs text-text-dim">{s.creator.slice(0, 6)}…{s.creator.slice(-6)}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
