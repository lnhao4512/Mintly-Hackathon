"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getMarketplaceProgram } from "@/utils/anchor";
import { getConfigPda } from "@/lib/config";
import { setMarketplacePaused } from "@/lib/marketplace";
import { useI18n } from "@/lib/i18n";
import { Loading, Skeleton } from "@/components/ui/Loading";

export default function AdminPage() {
  const { L } = useI18n();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(true);
  const [authority, setAuthority] = useState<string | null>(null);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    try {
      const program = getMarketplaceProgram(connection) as any;
      const [configPda] = getConfigPda();
      const config = await program.account.marketplaceConfig.fetch(configPda);
      setAuthority(config.authority.toBase58());
      setTreasury(config.treasury.toBase58());
      setPaused(Boolean(config.paused));
    } catch (err) {
      console.warn("Marketplace config not initialized yet:", err);
      setAuthority(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, [connection]);

  const isAuthority = Boolean(
    wallet.publicKey && authority && wallet.publicKey.toBase58() === authority
  );

  const [disputes, setDisputes] = useState<{ id: string; mintAddress: string; reporter: string; reason: string; evidenceUrl?: string }[]>([]);

  async function loadDisputes() {
    try {
      const res = await fetch("/api/disputes?status=open");
      setDisputes(((await res.json()) as { disputes: typeof disputes }).disputes ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadDisputes();
  }, []);

  async function resolve(id: string, status: "upheld" | "rejected") {
    if (!wallet.publicKey || !wallet.signMessage) return;
    setError(null);
    try {
      const sig = await wallet.signMessage(new TextEncoder().encode(`MINTLY_RESOLVE:${id}:${status}`));
      const res = await fetch("/api/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, admin: wallet.publicKey.toBase58(), signature: btoa(String.fromCharCode(...sig)) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || L("Xử lý thất bại", "Action failed"));
      loadDisputes();
    } catch (e) {
      setError(e instanceof Error ? e.message : L("Xử lý thất bại", "Action failed"));
    }
  }

  async function handleTogglePause() {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setSubmitting(true);
    setError(null);
    setTxHash(null);
    try {
      const tx = await setMarketplacePaused(connection, wallet, !paused);
      setTxHash(tx);
      await loadConfig();
    } catch (err: any) {
      setError(err?.message || L("Giao dịch thất bại.", "Transaction failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a09] text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-28 sm:px-8 sm:pt-32">
        <h1 className="font-display text-3xl text-text">{L("Quản Trị Sàn MINTLY", "MINTLY admin")}</h1>
        <p className="mt-2 text-sm text-text-dim">
          {L("Chỉ ví có quyền ", "Only the wallet that is the MarketplaceConfig ")}<span className="font-mono text-accent">authority</span>{L(" của MarketplaceConfig mới có thể tạm dừng/mở lại sàn.", " can pause or resume the marketplace.")}
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          {loading ? (
            <Loading label={L("Đang tải cấu hình...", "Loading configuration...")} compact />
          ) : !authority ? (
            <p className="text-sm text-amber-300">
              {L("Marketplace chưa được khởi tạo trên Solana (chưa có ai tạo đấu giá/listing đầu tiên).", "The marketplace has not been initialised on Solana yet (nobody has created the first auction or listing).")}
            </p>
          ) : (
            <>
              <div className="flex justify-between border-b border-white/5 pb-3 text-xs">
                <span className="text-text-dim">Authority</span>
                <span className="font-mono text-text break-all text-right">{authority}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-3 text-xs">
                <span className="text-text-dim">Treasury</span>
                <span className="font-mono text-text break-all text-right">{treasury}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-dim">{L("Trạng thái", "Status")}</span>
                <span className={paused ? "font-bold text-red-400" : "font-bold text-green-400"}>
                  {paused ? L("Đang tạm dừng", "Paused") : L("▶ Đang hoạt động", "▶ Running")}
                </span>
              </div>

              {!wallet.publicKey ? (
                <p className="text-xs text-text-dim">{L("Kết nối ví để quản trị.", "Connect a wallet to administer.")}</p>
              ) : !isAuthority ? (
                <p className="text-xs text-text-dim">
                  {L("Ví hiện tại (", "Current wallet (")}{wallet.publicKey.toBase58()}{L(") không có quyền quản trị.", ") has no admin rights.")}
                </p>
              ) : (
                <button
                  onClick={handleTogglePause}
                  disabled={submitting}
                  className={`w-full rounded-full py-3 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                    paused ? "bg-accent text-[#0a0a09] hover:bg-accent-strong" : "bg-red-600 text-white hover:bg-red-500"
                  }`}
                >
                  {submitting ? L("Đang xử lý...", "Processing...") : paused ? L("Mở Lại Sàn", "Resume marketplace") : L("Tạm Dừng Sàn", "Pause marketplace")}
                </button>
              )}

              {isAuthority && disputes.length > 0 && (
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <p className="text-xs uppercase tracking-wider text-text-dim">{L("Khiếu nại đạo nhái đang chờ (", "Pending plagiarism disputes (")}{disputes.length})</p>
                  {disputes.map((d) => (
                    <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-text-dim">
                      <p className="break-all font-mono">{d.mintAddress}</p>
                      <p className="mt-1 text-text">{d.reason}</p>
                      {d.evidenceUrl && <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{L("Bằng chứng", "Evidence")}</a>}
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => resolve(d.id, "upheld")} className="rounded-full bg-red-600 px-3 py-1 text-white">{L("Chấp nhận", "Uphold")}</button>
                        <button onClick={() => resolve(d.id, "rejected")} className="rounded-full border border-white/20 px-3 py-1">{L("Bác bỏ", "Reject")}</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {txHash && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs text-green-300 break-all">
                  Tx: {txHash}
                </div>
              )}
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
