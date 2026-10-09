"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Scannable QR that opens this artwork's passport (replay + on-chain proof) on any phone. */
export function PassportQR({ mint, title }: { mint: string; title?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = `${window.location.origin}/passport/${mint}`;
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0a09", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [mint]);

  if (!dataUrl) return null;

  return (
    <section className="glass-panel rounded-3xl p-6 sm:p-8">
      <p className="eyebrow text-accent-strong">Mã QR hộ chiếu</p>
      <div className="mt-4 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="QR passport" className="size-40 rounded-2xl border border-white/10 bg-white p-1" />
        <div className="space-y-3 text-sm text-text-dim">
          <p>Quét để xem quá trình vẽ, mã băm bằng chứng và lịch sử sở hữu của tác phẩm. In lên tranh vật lý hoặc ảnh bìa để người xem tự xác thực.</p>
          <a
            href={dataUrl}
            download={`mintly-passport-${(title || mint).replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`}
            className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text"
          >
            Tải mã QR
          </a>
        </div>
      </div>
    </section>
  );
}
