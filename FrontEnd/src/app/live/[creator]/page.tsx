"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { fetchLiveAuctions, type Auction } from "@/lib/data";

interface Session {
  creator: string;
  title: string;
  frame: string;
  live: boolean;
}

export default function LiveViewerPage({ params }: { params: Promise<{ creator: string }> }) {
  const { creator } = use(params);
  const { connection } = useConnection();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [auctions, setAuctions] = useState<Auction[]>([]);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live?creator=${encodeURIComponent(creator)}`);
        const data = (await res.json()) as { session: Session | null };
        if (active) setSession(data.session);
      } catch {
        // keep last frame
      } finally {
        if (active) setLoaded(true);
      }
    };
    poll();
    const timer = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [creator]);

  // Auctions by this artist (read from Solana) so viewers can bid as soon as the piece is listed
  useEffect(() => {
    let active = true;
    const load = () =>
      fetchLiveAuctions(connection)
        .then((all) => active && setAuctions(all.filter((a) => a.seller === creator && a.isLive)))
        .catch(() => {});
    load();
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connection, creator]);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[900px] px-5 pb-24 pt-32 sm:px-8">
        <div className="flex items-center gap-3">
          {session?.live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
              <span className="size-2 animate-pulse rounded-full bg-red-400" /> LIVE
            </span>
          ) : (
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-dim">Đã kết thúc / chưa phát</span>
          )}
          <p className="font-mono text-xs text-text-dim">{creator.slice(0, 6)}…{creator.slice(-6)}</p>
        </div>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl">{session?.title || "Phiên vẽ trực tiếp"}</h1>

        <div className="mt-6 aspect-square w-full max-w-[640px] overflow-hidden rounded-3xl border border-white/10 bg-white">
          {session?.frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.frame} alt="Canvas trực tiếp" className="size-full object-contain" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm text-neutral-500">{loaded ? "Chưa có hình ảnh" : "Đang kết nối..."}</div>
          )}
        </div>

        <section className="mt-8">
          <p className="eyebrow text-accent-strong">Đấu giá đang mở của nghệ sĩ</p>
          {auctions.length === 0 ? (
            <p className="mt-3 text-sm text-text-dim">Chưa có phiên đấu giá. Khi nghệ sĩ mint và đưa tác phẩm lên đấu giá, nó sẽ hiện ở đây.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {auctions.map((a) => (
                <Link key={a.id} href={`/auctions/${a.id}`} className="glass-panel rounded-2xl p-4 hover:border-white/20">
                  <p className="font-display text-xl">{a.title}</p>
                  <p className="mt-1 text-sm text-text-dim">Giá hiện tại: {a.currentBid} SOL</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
