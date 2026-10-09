"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageHero } from "@/components/layout/PageHero";
import { useI18n } from "@/lib/i18n";
import { analyzeArtworkSimilarity, type ArtworkSimilarityResult } from "@/lib/ai";
import { Loading, Skeleton } from "@/components/ui/Loading";

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
  const { locale, L } = useI18n();
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
    <div className="flex min-h-screen flex-col overflow-x-clip bg-bg text-text">
      <Navbar />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 pb-20 pt-32 sm:px-8 lg:px-12">
        <PageHero
          eyebrow={c.eyebrow}
          index={L("04 / Bằng chứng", "04 / Proof")}
          lines={[locale === "vi" ? "Kiểm tra" : "Originality", <em key="x">{locale === "vi" ? "nguyên bản" : "check"}</em>]}
          description={c.sub}
          actions={
            <label className="btn cursor-pointer">
              {c.pick} <span aria-hidden>↑</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          }
        />

        {preview && (
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="relative aspect-square overflow-hidden border border-line bg-bg-elevated lg:col-span-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="preview" className="size-full object-contain" />
              {busy && <div className="scan absolute inset-0" />}
              <i className="reg left-3 top-3" />
              <i className="reg right-3 top-3" />
              <i className="reg bottom-3 left-3" />
              <i className="reg bottom-3 right-3" />
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              {busy && <Loading label={c.scanning} />}
              {error && <p className="text-red-300">{c.err}</p>}
              {result && !busy && (
                <div className="border-t border-line pt-6">
                  <p className="eyebrow">{c.score}</p>
                  <p className="mega mt-2 text-[clamp(5rem,14vw,12rem)]">
                    {score != null ? Math.round(score) : "—"}
                    <em>%</em>
                  </p>
                  <div className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-line pt-4 text-sm">
                    <span className="eyebrow">{c.match}</span>
                    <span className="text-text-dim-2">
                      {result.closestMatch ? `${result.closestMatch.title} — ${Math.round(result.closestMatch.similarity)}%` : c.none}
                    </span>
                  </div>
                  <p className="mt-6 max-w-md text-xs leading-relaxed text-text-dim">{result.message}</p>
                  <p className="mt-3 max-w-md text-xs text-amber">{c.note}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
