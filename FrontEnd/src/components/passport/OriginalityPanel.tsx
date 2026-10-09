"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface Dispute {
  id: string;
  reporter: string;
  reason: string;
  evidenceUrl?: string;
  status: "open" | "upheld" | "rejected";
}

/** Originality badge (AI score recorded at mint) + community dispute reporting (wallet-signed). */
export function OriginalityPanel({ mint, score }: { mint: string; score?: number | null }) {
  const wallet = useWallet();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/disputes?mint=${encodeURIComponent(mint)}`);
      setDisputes(((await res.json()) as { disputes: Dispute[] }).disputes ?? []);
    } catch {
      // ignore
    }
  }, [mint]);

  useEffect(() => {
    load();
  }, [load]);

  const open = disputes.filter((d) => d.status === "open").length;
  const upheld = disputes.filter((d) => d.status === "upheld").length;

  async function submit() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setMsg("Hãy kết nối ví hỗ trợ ký tin nhắn (ví dụ Phantom).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const message = `MINTLY_DISPUTE:${mint}:${reason}`;
      const sig = await wallet.signMessage(new TextEncoder().encode(message));
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mintAddress: mint,
          reporter: wallet.publicKey.toBase58(),
          reason,
          evidenceUrl: evidenceUrl || undefined,
          signature: btoa(String.fromCharCode(...sig)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gửi khiếu nại thất bại");
      setReason("");
      setEvidenceUrl("");
      setMsg("Đã gửi khiếu nại. Quản trị viên sẽ xem xét.");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gửi khiếu nại thất bại");
    } finally {
      setBusy(false);
    }
  }

  const tone = upheld > 0 ? "text-red-300" : open > 0 ? "text-amber" : "text-green-300";

  return (
    <section className="glass-panel rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-accent-strong">Nhãn nguyên bản & Khiếu nại</p>
        <span className={`rounded-full border border-white/10 px-3 py-1 text-xs font-semibold ${tone}`}>
          {upheld > 0
            ? `Khiếu nại được chấp nhận (${upheld})`
            : open > 0
              ? `Đang bị khiếu nại (${open})`
              : score != null
                ? `Original ${Math.round(score)}%`
                : "Chưa có điểm AI"}
        </span>
      </div>

      {score != null && <p className="mt-3 text-sm text-text-dim">Điểm nguyên bản do AI ghi nhận tại thời điểm mint (so với catalogue và NFT đã có). Đây chỉ là cảnh báo.</p>}

      {disputes.length > 0 && (
        <ul className="mt-4 space-y-2 text-xs text-text-dim">
          {disputes.map((d) => (
            <li key={d.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="font-mono">{d.reporter.slice(0, 4)}…{d.reporter.slice(-4)}</span> · {d.status === "open" ? "đang chờ" : d.status === "upheld" ? "chấp nhận" : "bác bỏ"}
              <p className="mt-1 text-text">{d.reason}</p>
              {d.evidenceUrl && (
                <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  Bằng chứng
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-wider text-text-dim">Báo cáo đạo nhái</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Mô tả tác phẩm gốc bị sao chép (tối thiểu 10 ký tự)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-text outline-none focus:border-accent"
        />
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="Liên kết bằng chứng (https://...) — tuỳ chọn"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-text outline-none focus:border-accent"
        />
        <button
          onClick={submit}
          disabled={busy || reason.trim().length < 10}
          className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text disabled:opacity-40"
        >
          {busy ? "Đang ký & gửi..." : "Ký bằng ví & gửi khiếu nại"}
        </button>
        {msg && <p className="text-xs text-text-dim">{msg}</p>}
      </div>
    </section>
  );
}
