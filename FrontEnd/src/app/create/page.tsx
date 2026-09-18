"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/layout/Navbar";
import { DotsIcon, PlusIcon, ChevronDownIcon, SolanaIcon } from "@/components/ui/Icons";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { MintModal } from "@/components/canvas/MintModal";
import { mintNFT } from "@/lib/mint";
import { useI18n } from "@/lib/i18n";
import { analyzeArtworkSimilarity, registerMintedArtworkAI, type ArtworkSimilarityResult } from "@/lib/ai";
import { saveMintedArtwork } from "@/lib/artworkCache";

export default function CreatorStudioPage() {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, actions, handlers } = useDrawingCanvas(canvasRef);

  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [mintModalOpen, setMintModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fullscreenRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [aiCheck, setAiCheck] = useState<ArtworkSimilarityResult | null>(null);
  const [aiChecking, setAiChecking] = useState(false);

  const runAiSimilarityCheck = useCallback(async () => {
    setAiChecking(true);
    try {
      const base64Data = await actions.exportToBase64();
      if (base64Data) {
        const result = await analyzeArtworkSimilarity(base64Data, { name: title, description: statement });
        setAiCheck(result);
      }
    } catch (error) {
      console.error("AI similarity check failed:", error);
    } finally {
      setAiChecking(false);
    }
  }, [actions, title, statement]);

  const handlePreview = useCallback(async () => {
    const base64Data = await actions.exportToBase64();
    if (base64Data) {
      setPreviewUrl(base64Data);
      setPreviewModalOpen(true);
    }
  }, [actions]);

  // Dynamic cursor showing brush size
  const cursorSize = Math.max(4, state.brushSize * state.zoomScale);
  const cursorStyle =
    state.tool === "eraser"
      ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}'%3E%3Ccircle cx='${cursorSize / 2}' cy='${cursorSize / 2}' r='${cursorSize / 2 - 1}' fill='none' stroke='%23888' stroke-width='1' stroke-dasharray='3,2'/%3E%3C/svg%3E") ${cursorSize / 2} ${cursorSize / 2}, crosshair`
      : state.tool === "eyedropper"
      ? "crosshair"
      : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${cursorSize}' height='${cursorSize}'%3E%3Ccircle cx='${cursorSize / 2}' cy='${cursorSize / 2}' r='${cursorSize / 2 - 1}' fill='none' stroke='%23555' stroke-width='1'/%3E%3C/svg%3E") ${cursorSize / 2} ${cursorSize / 2}, crosshair`;

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await fullscreenRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const setZoomScale = actions.setZoomScale;
  useEffect(() => {
    const section = fullscreenRef.current;
    if (!section) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Prevent browser zoom
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        // Increase max zoom to 5x and min zoom to 0.2x for smooth scrolling
        setZoomScale((s) => Math.min(5, Math.max(0.2, s + delta)));
      }
    };

    // passive: false is required to prevent default browser zoom actions
    section.addEventListener("wheel", handleWheel, { passive: false });
    return () => section.removeEventListener("wheel", handleWheel);
  }, [setZoomScale]);

  const handleOpenMint = useCallback(async () => {
    if (!connected) {
      setVisible(true);
      return;
    }

    // Generate preview from canvas (Base64)
    const base64Data = await actions.exportToBase64();
    if (base64Data) {
      setPreviewUrl(base64Data);
      setAiChecking(true);
      try {
        setAiCheck(await analyzeArtworkSimilarity(base64Data, { name: title, description: statement }));
      } catch (error) {
        console.error("AI similarity check failed:", error);
      } finally {
        setAiChecking(false);
      }
    }
    setMintModalOpen(true);
  }, [connected, actions, setVisible, title, statement]);

  const handleConfirmMint = useCallback(
    async (onProgress?: (step: "preparing" | "awaiting-wallet" | "confirming" | "success") => void) => {
      if (!publicKey || !wallet) throw new Error("Wallet not connected");

      const base64Data = await actions.exportToBase64();
      if (!base64Data) throw new Error("Failed to export canvas");

      const result = await mintNFT(
        connection,
        wallet,
        base64Data,
        title,
        statement,
        publicKey.toBase58(),
        {
          files: [{ uri: base64Data, type: "image/png" }],
          category: "image",
          creators: [{ address: publicKey.toBase58(), share: 100 }],
        },
        onProgress
      );

      // Only now index and store artwork fingerprint into AI registry for copyright protection
      if (result && result.mintAddress) {
        // 1. Save to User Portfolio & Artwork Image Cache
        saveMintedArtwork({
          mintAddress: result.mintAddress,
          title: title || "Tác phẩm MINTLY",
          description: statement || "Tác phẩm kỹ thuật số được tạo từ MINTLY Studio.",
          imageUrl: base64Data,
          creator: publicKey.toBase58(),
          createdAt: Date.now(),
          signature: result.signature,
          category: "Độc bản 1/1",
          rarity: "rare",
        });

        // 2. Register into AI similarity index
        registerMintedArtworkAI(base64Data, {
          name: title || "Tác phẩm MINTLY",
          description: statement,
          mint: result.mintAddress,
        }).catch((err) => console.warn("Failed to register artwork in AI cache:", err));
      }

      return result;
    },
    [publicKey, wallet, connection, actions, title, statement]
  );

  const handleCloseMint = useCallback(() => {
    setMintModalOpen(false);
    // Base64 URLs don't need to be revoked, but we can set it to null
    // setPreviewUrl(null); // Keep preview url in case we want to show it again easily
  }, []);

  const handleBackToCanvas = useCallback(() => {
    actions.clear();
    setTitle("");
    setStatement("");
    setPreviewUrl(null);
  }, [actions]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Navbar />

      <main className="flex flex-1 gap-8 overflow-y-auto px-4 pb-8 pt-28 md:px-8 md:pt-32">
        {!connected ? (
          <section className="rainbow-border flex flex-1 items-center justify-center rounded-2xl bg-[rgba(18,18,18,0.72)] p-8 text-center backdrop-blur-xl">
            <div className="glass-panel flex w-full max-w-md flex-col items-center gap-5 rounded-2xl p-8">
              <div className="flex size-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-2xl text-accent">
                +
              </div>
              <div>
                <h1 className="font-display text-3xl text-text">{t("create.connectTitle")}</h1>
                <p className="mt-3 text-sm leading-6 text-text-dim">
                  {t("create.connectText")}
                </p>
              </div>
              <button
                onClick={() => setVisible(true)}
                className="rounded-full bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(184,165,255,0.7)]"
              >
                {t("create.connectPhantom")}
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* Canvas area */}
            <section 
              ref={fullscreenRef}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && (file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif|bmp|avif)$/i.test(file.name))) {
                  const ok = await actions.loadImage(file);
                  if (ok) {
                    setTimeout(() => {
                      runAiSimilarityCheck();
                    }, 150);
                  }
                }
              }}
              className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line-subtle bg-[#f8f8f8] shadow-[inset_0_2px_4px_1px_rgba(0,0,0,0.05)]"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />

              {/* Drag and Drop Overlay */}
              {isDraggingOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-all">
                  <div className="flex size-20 items-center justify-center rounded-full border-2 border-dashed border-accent bg-accent/10 text-accent animate-bounce">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 12V3m0 0L8 7m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="mt-4 font-display text-xl text-text">{t("create.dropImage")}</p>
                </div>
              )}

              {/* Canvas artboard with Native Scroll for Panning */}
              <div className="relative size-full overflow-y-auto flex items-center justify-center py-8">
                <div 
                  className="relative aspect-square shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out"
                  style={{
                    height: `calc(80% * ${state.zoomScale})`,
                    minHeight: `calc(320px * ${state.zoomScale})`,
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={1080}
                    height={1080}
                    className="absolute inset-0 size-full bg-white bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23eee%22/%3E%3Crect%20x=%228%22%20y=%228%22%20width=%228%22%20height=%228%22%20fill=%22%23eee%22/%3E%3C/svg%3E')]"
                    style={{ cursor: cursorStyle, touchAction: "none" }}
                    {...handlers}
                  />
                </div>
              </div>

              {/* Canvas status pill */}
              <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full border border-line-glass bg-[rgba(34,34,34,0.55)] px-4 py-2 backdrop-blur-md">
                <span className="size-2 rounded-full bg-[#e3e2e1]" />
                <span className="eyebrow">
                  {state.zoomScale !== 1 ? `${t("create.zoom")}: ${Math.round(state.zoomScale * 100)}%` : t("create.readyToDraw")}
                </span>
              </div>

              {/* Floating toolbar */}
              <CanvasToolbar 
                state={state} 
                actions={actions} 
                isFullscreen={isFullscreen} 
                onToggleFullscreen={toggleFullscreen} 
              />
            </section>

            {/* Metadata panel */}
            <aside className="flex w-[382px] shrink-0 flex-col gap-8 overflow-auto rounded-2xl border border-line-glass bg-[rgba(34,34,34,0.4)] p-8 backdrop-blur-md max-lg:hidden">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-[32px] leading-10 text-text">{t("create.provenance")}</h2>
                <button aria-label="More options" className="pb-2 text-text-dim hover:text-text">
                  <DotsIcon width={18} height={18} />
                </button>
              </div>

              {/* Upload Image Option */}
              <div className="flex flex-col gap-2">
                <span className="eyebrow">{t("create.uploadImage")}</span>
                <label className="flex cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3.5 text-xs font-semibold text-text transition-all hover:border-accent hover:bg-accent/10 hover:text-accent">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M12 12V3m0 0L8 7m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{t("create.uploadImage")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const ok = await actions.loadImage(file);
                        e.target.value = "";
                        if (ok) {
                          setTimeout(() => {
                            runAiSimilarityCheck();
                          }, 150);
                        }
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Title */}
              <label className="flex flex-col gap-3">
                <span className="eyebrow">{t("create.artworkTitle")}</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("create.titlePlaceholder")}
                  className="border-b border-white/10 bg-transparent pb-3 pt-2 font-sans text-lg text-text outline-none transition-colors placeholder:text-[rgba(196,199,199,0.5)] focus:border-accent"
                />
              </label>

          {/* Statement */}
          <label className="flex flex-col gap-3">
            <span className="eyebrow">{t("create.statement")}</span>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder={t("create.statementPlaceholder")}
              rows={4}
              className="resize-none rounded-[24px] border border-line-subtle bg-[rgba(32,31,31,0.3)] p-4 font-sans text-sm leading-6 text-text outline-none transition-colors placeholder:text-[rgba(196,199,199,0.5)] focus:border-accent"
            />
          </label>

          {/* Settings grid */}
          <div className="flex gap-6">
            <div className="flex flex-1 flex-col gap-3">
                <span className="eyebrow">{t("create.editions")}</span>
              <button className="flex items-center justify-between border-b border-white/10 pb-2 pt-1 font-sans text-lg text-text">
                {t("create.unique")}
                <ChevronDownIcon className="size-4 text-text-dim" width={16} height={16} />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-3">
                <span className="eyebrow">{t("create.network")}</span>
              <div className="flex items-center gap-2 border-b border-white/10 pb-2 pt-1">
                <SolanaIcon className="size-4 text-accent" width={16} height={16} />
                <span className="font-sans text-lg text-text">Solana</span>
                <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-accent">
                  Devnet
                </span>
              </div>
            </div>
          </div>

          {/* Properties */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t("create.properties")}</span>
              <button aria-label="Add property" className="pb-2 text-text-dim hover:text-text">
                <PlusIcon width={14} height={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                [t("create.medium"), t("create.digital")],
                [t("create.style"), t("create.freehand")],
                [t("create.platform"), "MINTLY"],
              ].map(([k, v]) => (
                <span
                  key={k}
                  className="flex items-center gap-2 rounded-full border border-line-subtle bg-[#201f1f] px-3 py-[7px]"
                >
                  <span className="eyebrow">{k}</span>
                  <span className="text-sm text-text">{v}</span>
                </span>
              ))}
            </div>
          </div>

          {/* AI Similarity & Provenance Card */}
          <div className="rounded-2xl border border-accent/20 bg-[rgba(26,20,38,0.6)] p-5 text-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-accent animate-pulse" />
                <p className="eyebrow text-accent-strong">{t("ai.title")}</p>
              </div>
              <button
                type="button"
                onClick={runAiSimilarityCheck}
                disabled={aiChecking}
                className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent transition-all hover:bg-accent hover:text-black disabled:opacity-50"
              >
                {aiChecking ? t("ai.checking") : t("ai.scanNow")}
              </button>
            </div>

            <div className="mt-4">
              {aiChecking ? (
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-xs text-text-dim">
                  <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-[11px] uppercase tracking-wider">{t("ai.checking")}</span>
                </div>
              ) : aiCheck ? (
                <div className="space-y-3">
                  {/* Status & Originality Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2.5 rounded-full ${
                          aiCheck.status === "LOW_SIMILARITY"
                            ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                            : aiCheck.status === "MODERATE_SIMILARITY"
                              ? "bg-amber-400 shadow-[0_0_10px_#f59e0b]"
                              : "bg-red-400 shadow-[0_0_10px_#f87171]"
                        }`}
                      />
                      <span className="font-semibold text-text text-xs">
                        {aiCheck.status === "LOW_SIMILARITY"
                          ? t("ai.original")
                          : aiCheck.status === "MODERATE_SIMILARITY"
                            ? "Độ tương đồng trung bình"
                            : t("ai.duplicateWarning")}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-accent">
                      {aiCheck.originalityScore ?? (100 - (aiCheck.similarity ?? 0)).toFixed(1)}% Nguyên bản
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${
                        aiCheck.status === "LOW_SIMILARITY"
                          ? "bg-gradient-to-r from-emerald-400 to-accent"
                          : aiCheck.status === "MODERATE_SIMILARITY"
                            ? "bg-gradient-to-r from-amber-400 to-orange-400"
                            : "bg-gradient-to-r from-red-500 to-pink-500"
                      }`}
                      style={{ width: `${aiCheck.originalityScore ?? 100 - (aiCheck.similarity ?? 0)}%` }}
                    />
                  </div>

                  {/* Dominant Palette Swatches */}
                  {aiCheck.dominantColors && aiCheck.dominantColors.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.02] p-2 border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-text-dim">Màu nhận diện:</span>
                      <div className="flex items-center gap-1.5">
                        {aiCheck.dominantColors.map((hex) => (
                          <span
                            key={hex}
                            title={hex}
                            className="size-4 rounded-full border border-white/20 shadow-sm"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Closest Match Information */}
                  {aiCheck.closestMatch && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-[11px] text-text-dim">
                      <div className="flex justify-between">
                        <span>Tác phẩm gần nhất:</span>
                        <strong className="text-text">{aiCheck.closestMatch.title}</strong>
                      </div>
                      <div className="mt-1 flex justify-between text-[10px]">
                        <span>Độ tương đồng thị giác:</span>
                        <span className="text-accent">{aiCheck.similarity}%</span>
                      </div>
                    </div>
                  )}

                  {/* Message & Proof Fingerprint */}
                  {aiCheck.message && (
                    <p className="text-[11px] leading-relaxed text-text-dim/80">{aiCheck.message}</p>
                  )}
                  {aiCheck.evidence?.[0] && (
                    <p className="break-all font-mono text-[9px] text-text-dim/50">
                      SHA256: {aiCheck.evidence[0].value.slice(0, 28)}...
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 text-xs text-text-dim">
                  <p>{t("ai.pending")}</p>
                  <button
                    type="button"
                    onClick={runAiSimilarityCheck}
                    className="w-full rounded-full border border-accent/30 bg-accent/10 py-2 text-center text-xs font-bold uppercase tracking-wider text-accent transition-all hover:bg-accent hover:text-black"
                  >
                    {t("ai.scanNow")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Wallet guard + Actions */}
          {!connected && (
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <p className="text-center text-sm text-text-dim">
                {t("create.connectMint")}
              </p>
              <button
                onClick={() => setVisible(true)}
                className="mt-3 w-full rounded-full bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#141313] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(184,165,255,0.7)]"
              >
                {t("nav.connect")}
              </button>
            </div>
          )}

          <div className="mt-auto flex gap-4 pt-8">
            <button 
              onClick={handlePreview}
              className="flex-1 rounded-full border border-white/10 px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-text transition-colors hover:border-text hover:bg-white/5"
            >
              {t("create.preview")}
            </button>
            <button
              onClick={handleOpenMint}
              className="flex-1 rounded-full bg-accent px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(184,165,255,0.7)] disabled:opacity-40 disabled:pointer-events-none"
            >
              {t("create.mintArtifact")}
            </button>
          </div>
            </aside>
          </>
        )}
      </main>

      {/* Mint confirmation modal */}
      <MintModal
        open={mintModalOpen}
        onClose={handleCloseMint}
        onBackToCanvas={handleBackToCanvas}
        onConfirm={handleConfirmMint}
        title={title}
        description={statement}
        previewUrl={previewUrl}
      />

      {/* Fullscreen Artwork Preview Modal */}
      {previewModalOpen && previewUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md transition-opacity"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div 
            className="relative flex aspect-square max-h-[80vh] max-w-[80vw] flex-col items-center justify-center rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={previewUrl} 
              alt="Artwork Preview" 
              className="h-full w-full rounded-2xl bg-white object-contain bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%3E%3Crect%20width=%228%22%20height=%228%22%20fill=%22%23eee%22/%3E%3Crect%20x=%228%22%20y=%228%22%20width=%228%22%20height=%228%22%20fill=%22%23eee%22/%3E%3C/svg%3E')]" 
            />
            <button
              className="absolute -right-12 top-0 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              onClick={() => setPreviewModalOpen(false)}
              aria-label="Close Preview"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
