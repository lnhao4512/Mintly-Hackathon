"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";

function VerifyContent() {
  const params = useSearchParams();
  const { connection } = useConnection();
  const { t } = useI18n();
  const [mint, setMint] = useState(params.get("mint") ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "missing" | "invalid">("idle");
  const [supply, setSupply] = useState<string | null>(null);

  async function verify() {
    setStatus("loading");
    try {
      const account = await getMint(connection, new PublicKey(mint.trim()));
      setSupply(account.supply.toString());
      setStatus("found");
    } catch {
      setSupply(null);
      setStatus(mint.trim() ? "missing" : "invalid");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[900px] px-5 pb-24 pt-32 sm:px-8">
        <p className="eyebrow text-accent-strong">MINTLY / EVIDENCE</p>
        <h1 className="mt-3 font-display text-5xl text-text sm:text-7xl">{t("verify.title")}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-text-dim">{t("verify.subtitle")}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <input value={mint} onChange={(event) => setMint(event.target.value)} placeholder={t("verify.placeholder")} className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-5 py-4 font-mono text-sm text-text outline-none focus:border-accent" />
          <button onClick={verify} disabled={status === "loading"} className="rounded-full bg-accent px-7 py-4 text-xs font-bold uppercase tracking-[0.12em] text-[#141313] disabled:opacity-50">{status === "loading" ? t("common.loading") : t("verify.button")}</button>
        </div>

        {status === "invalid" && <p className="mt-5 text-red-300">{t("verify.invalid")}</p>}
        {status === "missing" && <p className="mt-5 text-red-300">{t("verify.notFound")}</p>}
        {status === "found" && (
          <section className="glass-panel mt-8 rounded-3xl p-6">
            <div className="flex items-center gap-3 text-green-300"><span className="size-2 rounded-full bg-green-300" />{t("verify.found")}</div>
            <p className="mt-5 break-all font-mono text-sm text-text">{mint}</p>
            <dl className="mt-8 grid gap-5 sm:grid-cols-2">
              <div><dt className="eyebrow">{t("verify.supply")}</dt><dd className="mt-2 text-text">{supply}</dd></div>
              <div><dt className="eyebrow">{t("verify.evidence")}</dt><dd className="mt-2 text-text">{t("verify.metadataPending")}</dd></div>
            </dl>
            <p className="mt-6 rounded-2xl border border-amber/20 bg-amber/5 p-4 text-sm leading-6 text-amber">{t("verify.proofPending")}</p>
            <Link href={`/passport/${encodeURIComponent(mint)}`} className="mt-6 inline-flex rounded-full border border-white/10 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-text">{t("passport.title")}</Link>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense fallback={<div className="min-h-screen bg-[#0a0b0d]" />}><VerifyContent /></Suspense>;
}
