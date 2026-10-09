"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useI18n } from "@/lib/i18n";

interface Dispute {
  id: string;
  reporter: string;
  reason: string;
  evidenceUrl?: string;
  status: "open" | "upheld" | "rejected";
  bountySol?: number;
  bountyPaid?: boolean;
}

/** Originality badge (AI score recorded at mint) + community dispute reporting (wallet-signed). */
export function OriginalityPanel({ mint, score }: { mint: string; score?: number | null }) {
  const { L } = useI18n();
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
      setMsg(L("Hãy kết nối ví hỗ trợ ký tin nhắn (ví dụ Phantom).", "Connect a wallet that can sign messages (e.g. Phantom)."));
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
      if (!res.ok) throw new Error(data.error || L("Gửi khiếu nại thất bại", "Submitting the dispute failed"));
      setReason("");
      setEvidenceUrl("");
      setMsg(L("Đã gửi khiếu nại. Quản trị viên sẽ xem xét.", "Dispute submitted. An admin will review it."));
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : L("Gửi khiếu nại thất bại", "Submitting the dispute failed"));
    } finally {
      setBusy(false);
    }
  }

  const tone = upheld > 0 ? "text-red-300" : open > 0 ? "text-amber" : "text-green-300";

  return (
    <section className="glass-panel rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-accent-strong">{L("Nhãn nguyên bản & Khiếu nại", "Originality label & disputes")}</p>
        <span className={`rounded-full border border-white/10 px-3 py-1 text-xs font-semibold ${tone}`}>
          {upheld > 0
            ? L(`Khiếu nại được chấp nhận (${upheld})`, `Dispute upheld (${upheld})`)
            : open > 0
              ? L(`Đang bị khiếu nại (${open})`, `Under dispute (${open})`)
              : score != null
                ? `Original ${Math.round(score)}%`
                : L("Chưa có điểm AI", "No AI score yet")}
        </span>
      </div>

      {score != null && <p className="mt-3 text-sm text-text-dim">{L("Điểm nguyên bản do AI ghi nhận tại thời điểm mint (so với catalogue và NFT đã có). Đây chỉ là cảnh báo.", "Originality score recorded by AI at mint time (compared with the catalogue and existing NFTs). It is only a warning.")}</p>}

      {disputes.length > 0 && (
        <ul className="mt-4 space-y-2 text-xs text-text-dim">
          {disputes.map((d) => (
            <li key={d.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <span className="font-mono">{d.reporter.slice(0, 4)}…{d.reporter.slice(-4)}</span> · {d.status === "open" ? L("đang chờ", "pending") : d.status === "upheld" ? L("chấp nhận", "upheld") : L("bác bỏ", "rejected")}
              <p className="mt-1 text-text">{d.reason}</p>
              {d.status === "upheld" && d.bountySol ? (
                <p className="mt-1 text-green-300">
                  {L("Thưởng người báo cáo", "Reporter bounty")}: {d.bountySol} SOL — {d.bountyPaid ? L("đã chi trả", "paid") : L("chờ quản trị viên chi trả (ghi sổ, chưa tự động on-chain)", "awaiting payout by an admin (ledger entry, not automatic on-chain)")}
                </p>
              ) : null}
              {d.evidenceUrl && (
                <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {L("Bằng chứng", "Evidence")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-2">
        <p className="text-xs uppercase tracking-wider text-text-dim">{L("Báo cáo đạo nhái", "Report plagiarism")}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={L("Mô tả tác phẩm gốc bị sao chép (tối thiểu 10 ký tự)", "Describe the original work that was copied (at least 10 characters)")}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-text outline-none focus:border-accent"
        />
        <input
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder={L("Liên kết bằng chứng (https://...) — tuỳ chọn", "Evidence link (https://...) — optional")}
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-text outline-none focus:border-accent"
        />
        <button
          onClick={submit}
          disabled={busy || reason.trim().length < 10}
          className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text disabled:opacity-40"
        >
          {busy ? L("Đang ký & gửi...", "Signing & sending...") : L("Ký bằng ví & gửi khiếu nại", "Sign with wallet & submit dispute")}
        </button>
        {msg && <p className="text-xs text-text-dim">{msg}</p>}
      </div>
    </section>
  );
}
