"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { hashCreationTrace } from "@/lib/proof";
import { creationProofMemo } from "@/lib/mint";
import { useI18n } from "@/lib/i18n";

interface ProofResponse {
  proof: {
    method: "drawn" | "imported";
    strokes: number;
    durationMs: number;
    frames: string[];
    proofHash: string;
    signature?: string;
  } | null;
}

/**
 * Proof-of-Creation: replays the time-lapse recorded in the Studio and re-hashes the trace so the
 * viewer can compare it with the SPL Memo anchored in the NFT's mint transaction.
 */
export function CreationReplay({ mint }: { mint: string }) {
  const { L } = useI18n();
  const [proof, setProof] = useState<ProofResponse["proof"]>(null);
  const [recomputed, setRecomputed] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const { connection } = useConnection();
  const [onChain, setOnChain] = useState<"checking" | "match" | "mismatch" | "unavailable">("checking");

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
          // Verify the hash was anchored on-chain: read the Memo instruction from the mint transaction
          if (data.proof.signature) {
            try {
              const tx = await connection.getParsedTransaction(data.proof.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
              const memos = (tx?.transaction.message.instructions ?? [])
                .filter((ix) => "program" in ix && ix.program === "spl-memo")
                .map((ix) => ("parsed" in ix ? String(ix.parsed) : ""));
              const expected = creationProofMemo(mint, h, data.proof.method);
              if (active) setOnChain(memos.length === 0 ? "unavailable" : memos.includes(expected) ? "match" : "mismatch");
            } catch {
              if (active) setOnChain("unavailable");
            }
          } else if (active) setOnChain("unavailable");
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
  }, [mint, connection]);

  useEffect(() => {
    if (!proof || proof.frames.length < 2) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % proof.frames.length), 450);
    return () => clearInterval(timer);
  }, [proof]);

  if (!loaded) return null;

  if (!proof) {
    return (
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <p className="eyebrow text-accent-strong">{L("Bằng chứng sáng tác", "Proof of creation")}</p>
        <p className="mt-3 text-sm text-text-dim">{L("Tác phẩm này không có dữ liệu quá trình vẽ (mint trước khi có tính năng, hoặc không vẽ trên Studio).", "This artwork has no drawing-process data (minted before the feature existed, or not drawn in the Studio).")}</p>
      </section>
    );
  }

  const intact = recomputed === proof.proofHash;
  const minutes = Math.max(1, Math.round(proof.durationMs / 60000));

  return (
    <section className="glass-panel rounded-3xl p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-accent-strong">{L("Bằng chứng sáng tác (Proof-of-Creation)", "Proof-of-Creation")}</p>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
            proof.method === "drawn" ? "border-green-500/30 bg-green-500/10 text-green-300" : "border-amber/30 bg-amber/10 text-amber"
          }`}
        >
          {proof.method === "drawn" ? L("Vẽ tay trên Studio", "Hand-drawn in the Studio") : L("Có ảnh nhập vào", "Includes an imported image")}
        </span>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[200px_1fr]">
        {proof.frames.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof.frames[frame]} alt={L("Tái hiện quá trình vẽ", "Drawing process replay")} className="aspect-square w-full rounded-2xl border border-white/10 bg-white object-cover" />
        )}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-dim">{L("Số nét vẽ · Thời gian", "Strokes · Time")}</dt>
            <dd className="mt-1 text-text">{proof.strokes} {L("nét", "strokes")} · ~{minutes} {L("phút", "min")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-text-dim">{L("Mã băm bằng chứng (SHA-256)", "Proof hash (SHA-256)")}</dt>
            <dd className="mt-1 break-all rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-[11px] text-text">{proof.proofHash}</dd>
          </div>
          <p className={`text-xs ${intact ? "text-green-300" : "text-red-300"}`}>
            {intact ? L("✔ Dữ liệu replay khớp mã băm đã lưu.", "✔ Replay data matches the stored hash.") : L("✖ Dữ liệu replay KHÔNG khớp mã băm đã lưu.", "✖ Replay data does NOT match the stored hash.")}
          </p>
          <p className={`text-xs ${onChain === "match" ? "text-green-300" : onChain === "mismatch" ? "text-red-300" : "text-text-dim"}`}>
            {onChain === "match" && L("✔ Mã băm khớp Memo on-chain trong giao dịch mint (Solana).", "✔ The hash matches the on-chain Memo in the mint transaction (Solana).")}
            {onChain === "mismatch" && L("✖ Mã băm KHÔNG khớp Memo on-chain.", "✖ The hash does NOT match the on-chain Memo.")}
            {onChain === "checking" && L("Đang đối chiếu Memo on-chain...", "Checking the on-chain Memo...")}
            {onChain === "unavailable" && L("Không tìm thấy Memo on-chain (NFT mint trước tính năng này, hoặc RPC không trả giao dịch cũ).", "No on-chain Memo found (NFT minted before this feature, or the RPC did not return the old transaction).")}
          </p>
        </dl>
      </div>
      <p className="mt-4 text-[11px] leading-5 text-text-dim">
        {L("Mã băm này được neo on-chain bằng SPL Memo trong giao dịch mint. Đây là bằng chứng bổ sung về quá trình sáng tác, không phải kết luận pháp lý về bản quyền.", "This hash is anchored on-chain with the SPL Memo program in the mint transaction. It is supplementary evidence of the creative process, not a legal finding on copyright.")}
      </p>
    </section>
  );
}
