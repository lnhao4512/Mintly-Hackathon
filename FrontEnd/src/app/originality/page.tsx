"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";
import { analyzeArtworkSimilarity, type ArtworkSimilarityResult } from "@/lib/ai";

const copy = {
  vi: {
    eyebrow: "MIỄN PHÍ · KHÔNG CẦN VÍ",
    title: "Kiểm tra nguyên bản tác phẩm",
    sub: "Tải ảnh lên để so với catalogue và các NFT đã mint. Không cần ví, không mint, không tốn phí — dành cho sinh viên, giáo viên và người yêu nghệ thuật. Ảnh chỉ dùng để so sánh, không được đăng ký vào hệ thống.",
    pick: "Chọn ảnh",
    scanning: "Đang phân tích (lần đầu tải model ~90MB)...",
    score: "Điểm nguyên bản",
    match: "Giống nhất",
    none: "Không tìm thấy tác phẩm tương tự.",
    note: "Kết quả chỉ mang tính cảnh báo, không phải kết luận pháp lý về bản quyền.",
    err: "Không thể phân tích ảnh. Thử lại sau.",
  },
  en: {
    eyebrow: "FREE · NO WALLET",
    title: "Artwork originality check",
    sub: "Upload an image to compare it against the catalogue and minted NFTs. No wallet, no mint, no fee — for students, teachers and art lovers. The image is used for comparison only and is not registered.",
    pick: "Choose image",
    scanning: "Analysing (first run downloads a ~90MB model)...",
    score: "Originality score",
    match: "Closest match",
    none: "No similar artwork found.",
    note: "Results are warnings only, not a legal copyright finding.",
    err: "Could not analyse the image. Please try again.",
  },
} as const;

export default function OriginalityPage() {
  const { locale } = useI18n();
  const c = copy[locale];
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<ArtworkSimilarityResult | null>(null);

  function onFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const data = reader.result as string;
      setPreview(data);
      setResult(null);
      setError(false);
      setBusy(true);
      try {
        setResult(await analyzeArtworkSimilarity(data, { name: file.name }));
      } catch {
        setError(true);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const score = result?.originalityScore ?? (result?.similarity != null ? 100 - result.similarity : null);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[900px] px-5 pb-24 pt-32 sm:px-8">
        <p className="eyebrow text-accent-strong">{c.eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl sm:text-6xl">{c.title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-text-dim">{c.sub}</p>

        <label className="mt-8 inline-flex cursor-pointer rounded-full bg-accent px-7 py-4 text-xs font-bold uppercase tracking-[0.12em] text-[#141313]">
          {c.pick}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>

        {preview && (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="preview" className="w-full rounded-2xl border border-white/10" />
            <div className="glass-panel rounded-2xl p-5">
              {busy && <p className="text-text-dim">{c.scanning}</p>}
              {error && <p className="text-red-300">{c.err}</p>}
              {result && !busy && (
                <>
                  <p className="eyebrow">{c.score}</p>
                  <p className="mt-1 font-display text-5xl">{score != null ? `${Math.round(score)}%` : "—"}</p>
                  <p className="eyebrow mt-5">{c.match}</p>
                  <p className="mt-1 text-sm text-text-dim">
                    {result.closestMatch
                      ? `${result.closestMatch.title} — ${Math.round(result.closestMatch.similarity)}%`
                      : c.none}
                  </p>
                  <p className="mt-5 text-xs text-text-dim">{result.message}</p>
                  <p className="mt-3 text-xs text-amber">{c.note}</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
