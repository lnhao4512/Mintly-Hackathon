"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Navbar } from "@/components/layout/Navbar";
import { DotsIcon, PlusIcon, ChevronDownIcon, SolanaIcon } from "@/components/ui/Icons";
import { useDrawingCanvas } from "@/hooks/useDrawingCanvas";
import { CanvasToolbar } from "@/components/canvas/CanvasToolbar";
import { BrushPanel } from "@/components/canvas/BrushPanel";
import { LayersPanel } from "@/components/canvas/LayersPanel";
import { deleteDraft, draftKey, loadDraft, saveDraft, type DraftPayload } from "@/lib/paint/draftStore";
import { MintModal } from "@/components/canvas/MintModal";
import { mintNFT } from "@/lib/mint";
import { useI18n } from "@/lib/i18n";
import { analyzeArtworkSimilarity, registerMintedArtworkAI, type AiStage, type ArtworkSimilarityResult } from "@/lib/ai";
import { saveMintedArtwork } from "@/lib/artworkCache";
import { hashCreationTrace, sha256Hex } from "@/lib/proof";

export default function CreatorStudioPage() {
  const { t, L } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, actions, handlers } = useDrawingCanvas(canvasRef);

  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();

  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const [statement, setStatement] = useState("");

  // ---------------- drafts + leave guard ----------------
  const router = useRouter();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  // small screens start with the publish panel folded away so the canvas gets the room
  useEffect(() => {
    if (window.innerWidth < 1440) setRightOpen(false);
  }, []);
  const [metaDirty, setMetaDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftPayload | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const dKey = draftKey(publicKey?.toBase58());
  const unsaved = state.isDirty || metaDirty;
  const unsavedRef = useRef(false);
  unsavedRef.current = unsaved;

  const saveNow = useCallback(async (): Promise<boolean> => {
    const payload = actions.serializeDraft({ title, statement });
    if (!payload) return false;
    setSavingDraft(true);
    try {
      await saveDraft(dKey, payload);
      setSavedAt(payload.updatedAt);
      actions.markClean();
      setMetaDirty(false);
      return true;
    } catch (e) {
      console.warn("Draft save failed:", e);
      return false;
    } finally {
      setSavingDraft(false);
    }
  }, [actions, dKey, statement, title]);
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  const mintOpenRef = useRef(false);

  // offer to restore a saved draft when the studio opens
  useEffect(() => {
    if (!connected) return;
    let alive = true;
    loadDraft(dKey).then((d) => {
      if (alive && d) setPendingDraft(d);
    });
    return () => {
      alive = false;
    };
  }, [connected, dKey]);

  // autosave while there are unsaved changes (idle-time so drawing never stutters)
  useEffect(() => {
    if (!connected) return;
    const run = () => {
      if (!unsavedRef.current || mintOpenRef.current) return;
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(() => void saveRef.current(), { timeout: 4000 });
      else void saveRef.current();
    };
    const id = window.setInterval(run, 20000);
    const onHide = () => {
      if (document.visibilityState === "hidden" && unsavedRef.current) void saveRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [connected]);

  // closing / reloading the tab
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsavedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // clicking any in-app link (navbar, footer, menu...) while there is unsaved work
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!unsavedRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const leaveNow = useCallback(
    (target: string) => {
      unsavedRef.current = false;
      actions.markClean();
      setMetaDirty(false);
      setLeaveTarget(null);
      router.push(target);
    },
    [actions, router]
  );

  const saveAndLeave = useCallback(
    async (target: string) => {
      await saveNow();
      leaveNow(target);
    },
    [leaveNow, saveNow]
  );
  const [mintModalOpen, setMintModalOpen] = useState(false);
  // (mirrored into a ref for the autosave timer)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fullscreenRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  // ---- Live drawing broadcast -------------------------------------------------
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  const stopLive = useCallback(async () => {
    const id = liveSessionId;
    setLiveSessionId(null);
    if (id) fetch("/api/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end", sessionId: id }) }).catch(() => {});
  }, [liveSessionId]);

  const startLive = useCallback(async () => {
    setLiveError(null);
    if (!publicKey || !wallet.signMessage) {
      setLiveError(L("Hãy kết nối ví hỗ trợ ký tin nhắn (ví dụ Phantom).", "Connect a wallet that can sign messages (e.g. Phantom)."));
      return;
    }
    try {
      const nonce = crypto.randomUUID();
      const creator = publicKey.toBase58();
      const sig = await wallet.signMessage(new TextEncoder().encode(`MINTLY_LIVE:${creator}:${nonce}`));
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", creator, title: title.trim() || L("Đang vẽ", "Drawing"), nonce, signature: btoa(String.fromCharCode(...sig)) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || L("Không thể bắt đầu phát", "Could not start broadcasting"));
      setLiveSessionId(data.sessionId);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : L("Không thể bắt đầu phát", "Could not start broadcasting"));
    }
  }, [publicKey, wallet, title]);

  useEffect(() => {
    if (!liveSessionId) return;
    const timer = setInterval(() => {
      const frame = actions.getLiveFrame();
      if (!frame) return;
      fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "frame", sessionId: liveSessionId, frame, title: title || undefined }),
      }).catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [liveSessionId, actions, title]);

  // ---- Originality gate: exact copies are blocked, near-copies need a signed attestation ----
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [attestOpen, setAttestOpen] = useState(false);
  const [attestChecked, setAttestChecked] = useState(false);
  const [attestSig, setAttestSig] = useState<string | null>(null);
  const [attestError, setAttestError] = useState<string | null>(null);
  const [aiCheck, setAiCheck] = useState<ArtworkSimilarityResult | null>(null);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiStage, setAiStage] = useState<AiStage | null>(null);
  const aiStageLabel: Record<AiStage, string> = {
    preparing: L("Đang chuẩn bị ảnh...", "Preparing the image..."),
    "loading-model": L("Đang tải mô hình AI (chỉ lần đầu)...", "Loading the AI model (first time only)..."),
    embedding: L("AI đang phân tích hình ảnh...", "AI is analysing the image..."),
    comparing: L("Đang đối chiếu với kho tác phẩm...", "Comparing with existing artworks..."),
  };

  const runAiSimilarityCheck = useCallback(async () => {
    setAiChecking(true);
    try {
      const base64Data = await actions.exportToBase64();
      if (base64Data) {
        const result = await analyzeArtworkSimilarity(base64Data, { name: title, description: statement }, setAiStage);
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

    if (!title.trim()) {
      setRightOpen(true);
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }

    // Generate preview from canvas (Base64)
    const base64Data = await actions.exportToBase64();
    if (base64Data) {
      setPreviewUrl(base64Data);
      setAiChecking(true);
      setBlockReason(null);
      try {
        const result = await analyzeArtworkSimilarity(base64Data, { name: title, description: statement }, setAiStage);
        setAiCheck(result);
        if (result.matchType === "EXACT") {
          setBlockReason(L(`Ảnh này trùng khớp hoàn toàn với "${result.closestMatch?.title ?? "một tác phẩm đã có"}". {L("Không thể mint", "Cannot mint")} bản sao y hệt.`, `This image is an exact match for "${result.closestMatch?.title ?? "an existing artwork"}". An identical copy cannot be minted.`));
          return;
        }
        if (result.status === "HIGH_SIMILARITY" && !attestSig) {
          setAttestChecked(false);
          setAttestError(null);
          setAttestOpen(true);
          return;
        }
      } catch (error) {
        console.error("AI similarity check failed:", error);
      } finally {
        setAiChecking(false);
      }
    }
    setMintModalOpen(true);
  }, [connected, actions, setVisible, title, statement, attestSig]);

  const confirmAttestation = useCallback(async () => {
    if (!publicKey || !wallet.signMessage || !previewUrl) return;
    setAttestError(null);
    try {
      const hash = await sha256Hex(previewUrl);
      const sig = await wallet.signMessage(new TextEncoder().encode(`MINTLY_ATTEST:${publicKey.toBase58()}:${hash}`));
      setAttestSig(btoa(String.fromCharCode(...sig)));
      setAttestOpen(false);
      setMintModalOpen(true);
    } catch (e) {
      setAttestError(e instanceof Error ? e.message : L("Không thể ký xác nhận", "Could not sign the confirmation"));
    }
  }, [publicKey, wallet, previewUrl]);

  const handleConfirmMint = useCallback(
    async (onProgress?: (step: "preparing" | "awaiting-wallet" | "confirming" | "success") => void) => {
      if (!publicKey || !wallet) throw new Error("Wallet not connected");
      if (!title.trim()) throw new Error("Artwork title is required");

      const base64Data = await actions.exportToBase64();
      if (!base64Data) throw new Error("Failed to export canvas");

      // Final check on the exact pixels being minted; the fingerprint is written into the NFT
      // metadata (and therefore into the creation proof) so provenance order can be proven.
      const finalCheck = await analyzeArtworkSimilarity(base64Data, { name: title, description: statement }).catch(() => null);
      if (finalCheck?.matchType === "EXACT") {
        throw new Error(L("Ảnh trùng khớp hoàn toàn với tác phẩm đã có — không thể mint.", "The image exactly matches an existing artwork — it cannot be minted."));
      }
      const provenanceAttributes = finalCheck?.perceptualHash
        ? [
            { trait_type: "Perceptual Hash", value: finalCheck.perceptualHash },
            { trait_type: "Originality Score", value: `${finalCheck.originalityScore ?? ""}` },
            ...(attestSig ? [{ trait_type: "Originality Attestation", value: attestSig.slice(0, 44) }] : []),
          ]
        : [];

      // Proof-of-creation: the hash of the time-lapse trace is anchored on-chain via the SPL Memo program in the mint tx;
      // the frames themselves are stored off-chain (MongoDB).
      const trace = actions.getCreationTrace();
      const proofHash = await hashCreationTrace(trace);
      const creationAttributes = [
        { trait_type: "Creation Method", value: trace.method },
        { trait_type: "Creation Proof", value: proofHash },
      ];

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
        onProgress,
        [...provenanceAttributes, ...creationAttributes],
        { hash: proofHash, method: trace.method }
      );

      // Only now index and store artwork fingerprint into AI registry for copyright protection
      if (result && result.mintAddress) {
        // 1. Save to User Portfolio & Artwork Image Cache
        saveMintedArtwork({
          mintAddress: result.mintAddress,
          title: title.trim(),
          description: statement.trim(),
          imageUrl: base64Data,
          creator: publicKey.toBase58(),
          createdAt: Date.now(),
          signature: result.signature,
          category: L("Độc bản 1/1", "1/1 original"),
          rarity: "rare",
          originalityScore: finalCheck?.originalityScore ?? null,
        });

        fetch("/api/proofs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...trace, mintAddress: result.mintAddress, creator: publicKey.toBase58(), proofHash, signature: result.signature }),
        }).catch((err) => console.warn("Failed to store creation proof:", err));

        void deleteDraft(dKey);
        actions.markClean();
        setMetaDirty(false);

        // 2. Register into AI similarity index
        registerMintedArtworkAI(base64Data, {
          name: title.trim(),
          description: statement,
          mint: result.mintAddress,
        }).catch((err) => console.warn("Failed to register artwork in AI cache:", err));
      }

      return result;
    },
    [publicKey, wallet, connection, actions, title, statement, attestSig, dKey]
  );

  mintOpenRef.current = mintModalOpen;

  const handleCloseMint = useCallback(() => {
    setMintModalOpen(false);
    // Base64 URLs don't need to be revoked, but we can set it to null
    // setPreviewUrl(null); // Keep preview url in case we want to show it again easily
  }, []);

  const handleBackToCanvas = useCallback(() => {
    actions.clear();
    void deleteDraft(dKey);
    setMetaDirty(false);
    setSavedAt(null);
    setTitle("");
    setStatement("");
    setPreviewUrl(null);
  }, [actions, dKey]);

  return (
    <div className="relative flex h-[calc(100svh-30px)] flex-col overflow-hidden">
      <Navbar />

      <main className="flex min-h-0 flex-1 gap-3 overflow-hidden px-3 pb-4 pt-24 md:px-5 md:pt-24">
        {!connected ? (
          <section className="relative flex flex-1 flex-col justify-between overflow-hidden border border-line p-6 sm:p-10">
            <div className="flex items-center justify-between font-mono-ui text-[10px] uppercase tracking-[0.18em] text-text-dim">
              <span className="flex items-center gap-2 text-accent"><span className="size-1.5 rounded-full bg-accent" />Studio</span>
              <span>{L("03 / Sáng tạo", "03 / Create")}</span>
            </div>
            <div>
              <h1 className="mega text-[clamp(3rem,10vw,10rem)]">
                {t("create.connectTitle")}
              </h1>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-text-dim-2">{t("create.connectText")}</p>
              <button onClick={() => setVisible(true)} className="btn mt-8">
                {t("create.connectPhantom")} <span aria-hidden>→</span>
              </button>
            </div>
            <i className="reg left-3 top-3" />
            <i className="reg right-3 top-3" />
            <i className="reg bottom-3 left-3" />
            <i className="reg bottom-3 right-3" />
          </section>
        ) : (
          <>
            {/* Left: drawing tools — brushes, colour, layers */}
            {leftOpen && (
              <aside
                data-lenis-prevent
                className="flex w-[300px] shrink-0 flex-col gap-6 overflow-y-auto overflow-x-hidden overscroll-contain border border-line bg-[rgba(18,18,17,0.7)] p-5 backdrop-blur-md max-lg:hidden"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-light tracking-[-0.03em]">{L("Dụng cụ", "Tools")}</h2>
                  <button type="button" onClick={() => setLeftOpen(false)} title={L("Thu gọn", "Collapse")} aria-label="collapse tools" className="flex size-8 items-center justify-center border border-line text-text-dim transition-colors hover:border-text hover:text-text">
                    ‹
                  </button>
                </div>
                <BrushPanel state={state} actions={actions} />
                <div className="border-t border-line" />
                <LayersPanel state={state} actions={actions} />
              </aside>
            )}

            {/* Canvas area (centre) */}
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
              className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden border border-line bg-[#171716]"
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(236,231,218,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(236,231,218,0.045) 1px, transparent 1px)",
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
              <div className="relative size-full overflow-auto flex items-start justify-center pt-5 pb-24">
                <div 
                  className="relative aspect-square shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.35)] transition-all duration-200 ease-out"
                  style={{
                    height: `calc((100% - 6.5rem) * ${state.zoomScale})`,
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

              {/* handles for collapsed side panels */}
              {!leftOpen && (
                <button
                  type="button"
                  onClick={() => setLeftOpen(true)}
                  className="absolute left-4 top-16 z-10 border border-line bg-ink/90 px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text backdrop-blur-sm transition-colors hover:border-accent max-lg:hidden"
                >
                  › {L("Dụng cụ", "Tools")}
                </button>
              )}
              {!rightOpen && (
                <button
                  type="button"
                  onClick={() => setRightOpen(true)}
                  className="absolute right-4 top-4 z-10 border border-line bg-ink/90 px-3 py-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text backdrop-blur-sm transition-colors hover:border-accent max-lg:hidden"
                >
                  {L("Xuất bản", "Publish")} ‹
                </button>
              )}

              {/* Canvas status pill */}
              <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full border border-line-glass bg-[rgba(34,34,34,0.55)] px-4 py-2 backdrop-blur-md">
                <span className="size-2 rounded-full bg-[#e3e2e1]" />
                <span className="eyebrow">
                  {state.zoomScale !== 1
                    ? `${t("create.zoom")}: ${Math.round(state.zoomScale * 100)}%`
                    : unsaved
                      ? L("Chưa lưu", "Unsaved")
                      : savedAt
                        ? L("Đã lưu nháp", "Draft saved")
                        : t("create.readyToDraw")}
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

            {/* Right: publish — metadata, AI originality check, draft + mint */}
            {rightOpen && (
            <aside
              data-lenis-prevent
              className="flex w-[340px] shrink-0 flex-col gap-6 overflow-y-auto overflow-x-hidden overscroll-contain border border-line bg-[rgba(18,18,17,0.7)] p-5 backdrop-blur-md max-lg:hidden"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-light tracking-[-0.03em]">{L("Xuất bản", "Publish")}</h2>
                <button type="button" onClick={() => setRightOpen(false)} title={L("Thu gọn", "Collapse")} aria-label="collapse publish" className="flex size-8 items-center justify-center border border-line text-text-dim transition-colors hover:border-text hover:text-text">
                  ›
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
                <span className="eyebrow">{t("create.artworkTitle")} <span className="text-accent">*</span></span>
                <input
                  ref={titleRef}
                  required
                  maxLength={80}
                  aria-invalid={titleError}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleError(false);
                    setMetaDirty(true);
                  }}
                  placeholder={t("create.titlePlaceholder")}
                  className={`border-b ${titleError ? "border-red-400" : "border-white/10"} bg-transparent pb-3 pt-2 font-sans text-lg text-text outline-none transition-colors placeholder:text-[rgba(196,199,199,0.5)] focus:border-accent`}
                />
                {titleError && (
                  <span className="text-xs text-red-300">{L("Vui lòng nhập tên tác phẩm trước khi xuất bản.", "Please enter a title before publishing.")}</span>
                )}
              </label>

          {/* Statement */}
          <label className="flex flex-col gap-3">
            <span className="eyebrow">{t("create.statement")} <span className="normal-case tracking-normal text-text-dim">({L("tùy chọn", "optional")})</span></span>
            <textarea
              value={statement}
              onChange={(e) => {
                setStatement(e.target.value);
                setMetaDirty(true);
              }}
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
                  <span className="text-[11px] uppercase tracking-wider">{aiStage ? aiStageLabel[aiStage] : t("ai.checking")}</span>
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
                            ? L("Độ tương đồng trung bình", "Moderate similarity")
                            : t("ai.duplicateWarning")}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-accent">
                      {aiCheck.originalityScore ?? (100 - (aiCheck.similarity ?? 0)).toFixed(1)}% {L("Nguyên bản", "Original")}
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full transition-all duration-500 ${
                        aiCheck.status === "LOW_SIMILARITY"
                          ? "bg-gradient-to-r from-emerald-400 to-accent"
                          : aiCheck.status === "MODERATE_SIMILARITY"
                            ? "bg-gradient-to-r from-amber-400 to-accent-strong"
                            : "bg-gradient-to-r from-red-500 to-accent"
                      }`}
                      style={{ width: `${aiCheck.originalityScore ?? 100 - (aiCheck.similarity ?? 0)}%` }}
                    />
                  </div>

                  {/* Dominant Palette Swatches */}
                  {aiCheck.dominantColors && aiCheck.dominantColors.length > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-white/[0.02] p-2 border border-white/5">
                      <span className="text-[10px] uppercase tracking-wider text-text-dim">{L("Màu nhận diện:", "Dominant colours:")}</span>
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
                        <span>{L("Tác phẩm gần nhất:", "Closest artwork:")}</span>
                        <strong className="text-text">{aiCheck.closestMatch.title}</strong>
                      </div>
                      <div className="mt-1 flex justify-between text-[10px]">
                        <span>{L("Độ tương đồng tổng hợp:", "Overall similarity:")}</span>
                        <span className="text-accent">{aiCheck.similarity}%</span>
                      </div>
                      {aiCheck.matchType && aiCheck.matchType !== "DISTINCT" && (
                        <div className="mt-1 flex justify-between text-[10px]">
                          <span>{L("Loại trùng lặp:", "Type of match:")}</span>
                          <span className="text-text">
                            {aiCheck.matchType === "EXACT"
                              ? L("Bản sao y hệt", "Exact copy")
                              : aiCheck.matchType === "NEAR_DUPLICATE"
                                ? L("Ảnh chỉnh sửa nhẹ", "Lightly edited copy")
                                : L("Nhái phong cách/bố cục", "Style / layout imitation")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-signal breakdown */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[
                      ["Hash", aiCheck.hashSimilarity],
                      [L("Bố cục", "Layout"), aiCheck.visualSimilarity],
                      [L("Màu", "Colour"), aiCheck.colorSimilarity],
                      ["AI", aiCheck.embeddingAvailable ? aiCheck.semanticSimilarity : null],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-lg border border-white/5 bg-white/[0.02] px-1 py-1.5">
                        <div className="font-mono text-[11px] font-bold text-text">
                          {value == null ? "—" : `${value}%`}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-text-dim">{label as string}</div>
                      </div>
                    ))}
                  </div>

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
                className="mt-3 w-full rounded-full bg-accent px-6 py-3 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-[#0a0a09] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(255,77,31,0.7)]"
              >
                {t("nav.connect")}
              </button>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-5">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text-dim">
              {unsaved ? (
                <span className="text-amber">● {L("Chưa lưu", "Unsaved changes")}</span>
              ) : savedAt ? (
                `✓ ${L("Đã lưu nháp", "Draft saved")} ${new Date(savedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
              ) : (
                L("Chưa có bản nháp", "No draft yet")
              )}
            </span>
            <button
              type="button"
              onClick={() => void saveNow()}
              disabled={savingDraft || !unsaved}
              className="border border-line px-4 py-2 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-text transition-colors hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-40"
            >
              {savingDraft ? L("Đang lưu…", "Saving…") : L("Lưu nháp", "Save draft")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button 
              onClick={handlePreview}
              className="border border-line px-3 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-text transition-colors hover:border-text hover:bg-white/5"
            >
              {t("create.preview")}
            </button>
            <div className="space-y-1">
              <button
                onClick={liveSessionId ? stopLive : startLive}
                className={`h-full w-full border px-3 py-3 font-sans text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${
                  liveSessionId ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-white/15 text-text hover:border-white/30"
                }`}
              >
                {liveSessionId ? L("● Đang live — dừng", "● Live — stop") : L("Phát trực tiếp", "Go live")}
              </button>
              {liveSessionId && publicKey && (
                <a href={`/live/${publicKey.toBase58()}`} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] text-accent hover:underline">
                  {L("Mở trang người xem", "Open the viewer page")}
                </a>
              )}
              {liveError && <p className="text-center text-[11px] text-red-300">{liveError}</p>}
            </div>
            <button
              onClick={handleOpenMint}
              className="col-span-2 bg-accent px-6 py-4 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-[#0a0a09] transition-all hover:bg-accent-strong hover:shadow-[0_10px_40px_-8px_rgba(255,77,31,0.7)] disabled:opacity-40 disabled:pointer-events-none"
            >
              {t("create.mintArtifact")}
            </button>
          </div>
            </aside>
            )}
          </>
        )}
      </main>

      {pendingDraft && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-line bg-[#121211] p-6">
            <p className="eyebrow text-accent">{L("Bản nháp chưa hoàn thành", "Unfinished draft")}</p>
            <p className="mt-2 font-display text-3xl font-light tracking-[-0.03em]">{pendingDraft.title || L("Chưa đặt tên", "Untitled")}</p>
            <div className="mt-4 flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingDraft.thumb} alt="" className="size-24 border border-line bg-white object-cover" />
              <div className="text-sm text-text-dim-2">
                <p>
                  {pendingDraft.layers.length} {L("lớp", "layers")} · {pendingDraft.trace.strokes} {L("nét vẽ", "strokes")}
                </p>
                <p className="mt-1 text-text-dim">
                  {L("Lưu lúc", "Saved")} {new Date(pendingDraft.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn flex-1 !py-3"
                onClick={async () => {
                  const d = pendingDraft;
                  setPendingDraft(null);
                  await actions.restoreDraft(d);
                  setTitle(d.title);
                  setStatement(d.statement);
                  setSavedAt(d.updatedAt);
                  setMetaDirty(false);
                }}
              >
                {L("Tiếp tục vẽ", "Continue drawing")}
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1 !py-3"
                onClick={() => {
                  void deleteDraft(dKey);
                  setPendingDraft(null);
                }}
              >
                {L("Bắt đầu mới", "Start fresh")}
              </button>
            </div>
          </div>
        </div>
      )}

      {leaveTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-line bg-[#121211] p-6">
            <p className="eyebrow text-amber">{L("Bạn có thay đổi chưa lưu", "You have unsaved changes")}</p>
            <p className="mt-2 font-display text-3xl font-light tracking-[-0.03em]">{L("Rời khỏi Studio?", "Leave the Studio?")}</p>
            <p className="mt-3 text-sm text-text-dim-2">
              {L("Tranh đang vẽ sẽ mất nếu bạn rời đi mà không lưu. Lưu nháp để tiếp tục vẽ sau.", "Your drawing will be lost if you leave without saving. Save a draft to keep working later.")}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button type="button" className="btn !py-3" disabled={savingDraft} onClick={() => void saveAndLeave(leaveTarget)}>
                {savingDraft ? L("Đang lưu…", "Saving…") : L("Lưu nháp & rời đi", "Save draft & leave")}
              </button>
              <button type="button" className="btn btn-ghost !py-3" onClick={() => leaveNow(leaveTarget)}>
                {L("Rời đi, không lưu", "Leave without saving")}
              </button>
              <button type="button" className="py-2 font-mono-ui text-[11px] uppercase tracking-[0.16em] text-text-dim hover:text-text" onClick={() => setLeaveTarget(null)}>
                {L("Ở lại vẽ tiếp", "Stay and keep drawing")}
              </button>
            </div>
          </div>
        </div>
      )}

      {blockReason && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={() => setBlockReason(null)}>
          <div className="w-full max-w-md border border-line bg-[#121211] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-2xl text-red-300">{L("Không thể mint", "Cannot mint")}</p>
            <p className="mt-3 text-sm text-text-dim">{blockReason}</p>
            <button onClick={() => setBlockReason(null)} className="mt-5 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text">{L("Đã hiểu", "Got it")}</button>
          </div>
        </div>
      )}

      {attestOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md border border-line bg-[#121211] p-6">
            <p className="font-display text-2xl text-amber">{L("Ảnh rất giống tác phẩm khác", "This image closely resembles another artwork")}</p>
            <p className="mt-3 text-sm text-text-dim">
              {L(`AI thấy ảnh này giống ${Math.round(aiCheck?.similarity ?? 0)}% với \u201c${aiCheck?.closestMatch?.title ?? "một tác phẩm đã có"}\u201d. Nếu đây là tác phẩm của bạn, hãy xác nhận và ký bằng ví. Chữ ký được ghi vào metadata, và nếu bị khiếu nại đạo nhái, nó là bằng chứng bạn đã cam kết.`, `AI finds this image ${Math.round(aiCheck?.similarity ?? 0)}% similar to \u201c${aiCheck?.closestMatch?.title ?? "an existing artwork"}\u201d. If it is your own work, confirm and sign with your wallet. The signature is recorded in the metadata and is evidence of your commitment if a plagiarism dispute is raised.`)}
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-text">
              <input type="checkbox" checked={attestChecked} onChange={(e) => setAttestChecked(e.target.checked)} className="mt-1" />
              {L("Tôi là tác giả và chịu trách nhiệm về tính nguyên bản của tác phẩm này.", "I am the author and take responsibility for the originality of this artwork.")}
            </label>
            {attestError && <p className="mt-3 text-xs text-red-300">{attestError}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setAttestOpen(false)} className="flex-1 rounded-full border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-text">{L("Hủy", "Cancel")}</button>
              <button
                onClick={confirmAttestation}
                disabled={!attestChecked}
                className="flex-1 rounded-full bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0a0a09] disabled:opacity-40"
              >
                {L("Ký & tiếp tục", "Sign & continue")}
              </button>
            </div>
          </div>
        </div>
      )}

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
