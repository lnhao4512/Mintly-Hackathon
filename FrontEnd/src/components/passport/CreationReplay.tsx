"use client";

import { useEffect, useState } from "react";
import { hashCreationTrace } from "@/lib/proof";

interface ProofResponse {
  proof: {
    method: "drawn" | "imported";
    strokes: number;
    durationMs: number;
    frames: string[];
    proofHash: string;
  } | null;
}

/**
 * Proof-of-Creation: replays the time-lapse recorded in the Studio and re-hashes the trace so the
 * viewer can compare it with the "Creation Proof" attribute written into the NFT's Metaplex metadata.
 */
export function CreationReplay({ mint }: { mint: string }) {
  const [proof, setProof] = useState<ProofResponse["proof"]>(null);
  const [recomputed, setRecomputed] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/proofs?mint=${encodeURIComponent(mint)}`);
        const data = (await res.json()) as ProofResponse;
        if (!active) return;
        setProof(data.proof);
        if (data.proof) {
          const h = await hashCreationTrace(data.proof);
          if (active) setRecomputed(h);
        }
      } catch {
        // no proof available
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [mint]);

  useEffect(() => {
    if (!proof || proof.frames.length < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % proof.frames.length), 450);
    return () => clearInterval(timer);
  }, [proof]);

  if (!loaded) return null;

  if (!proof) {
    return (
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <p className="eyebrow text-accent-strong">Bằng chứng sáng tác</p>
        <p className="mt-3 text-sm text-text-dim">Tác phẩm này không có dữ liệu quá trình vẽ (mint trước khi có tính năng, hoặc không vẽ trên Studio).</p>
      </section>
    );
  }

  const intact = recomputed === proof.proofHash;
  const minutes = Math.max(1, Math.round(proof.durationMs / 60000));

  return (
    <section className="glass-panel rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-accent-strong">Bằng chứng sáng tác (Proof-of-Creation)</p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
            proof.method === "drawn" ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-amber/30 bg-amber/10 text-amber"
          }`}
        >
          {proof.method === "drawn" ? "Vẽ tay trên Studio" : "Có ảnh nhập vào"}
        </span>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[200px_1fr]">
        {proof.frames.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof.frames[frame]} alt="Tái hiện quá trình vẽ" className="aspect-square w-full rounded-2xl border border-white/10 bg-white object-cover" />
        )}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-dim">Số nét vẽ · Thời gian</dt>
            <dd className="mt-1 text-text">{proof.strokes} nét · ~{minutes} phút</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-dim">Mã băm bằng chứng (SHA-256)</dt>
            <dd className="mt-1 break-all rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-text">{proof.proofHash}</dd>
          </div>
          <p className={`text-xs ${intact ? "text-green-300" : "text-red-300"}`}>
            {intact ? "✔ Dữ liệu replay khớp mã băm đã lưu." : "✖ Dữ liệu replay KHÔNG khớp mã băm đã lưu."}
          </p>
        </dl>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-text-dim">
        Mã băm này cũng được ghi trong thuộc tính &quot;Creation Proof&quot; của metadata NFT (Metaplex). Đây là bằng chứng bổ sung về quá trình sáng tác, không phải kết luận pháp lý về bản quyền.
      </p>
    </section>
  );
}
