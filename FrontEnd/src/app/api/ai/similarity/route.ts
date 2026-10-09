import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { analyzeArtwork, registerMintedArtwork, type AnalyzeInput } from "@/lib/visionSimilarity";

// sharp needs the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const maxDuration = 30;

interface SimilarityRequest extends Partial<AnalyzeInput> {
  action?: "analyze" | "register";
}

const MAX_IMAGE_CHARS = 4_000_000; // Vercel rejects request bodies > 4.5MB anyway

export async function POST(request: Request) {
  let body: SimilarityRequest;
  try {
    body = (await request.json()) as SimilarityRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageData || typeof body.imageData !== "string" || !body.imageData.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageData (image data URL) is required" }, { status: 400 });
  }
  if (body.imageData.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "imageData too large — send a downscaled thumbnail" }, { status: 413 });
  }
  if (body.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(body.sha256)) {
    return NextResponse.json({ error: "sha256 must be 64 hex chars" }, { status: 400 });
  }

  const input: AnalyzeInput = {
    imageData: body.imageData,
    sha256: body.sha256,
    embedding: body.embedding,
    metadata: body.metadata,
    locale: body.locale === "en" ? "en" : "vi",
  };

  // Handle explicit indexing after on-chain minting
  if (body.action === "register") {
    try {
      new PublicKey(body.metadata?.mint ?? "");
    } catch {
      return NextResponse.json({ error: "A valid metadata.mint address is required" }, { status: 400 });
    }
    const registered = await registerMintedArtwork(input);
    return NextResponse.json({
      success: registered,
      message: registered
        ? "Tác phẩm đã được lưu vào hệ thống cơ sở dữ liệu để bảo vệ quyền tác giả."
        : "Không thể trích xuất dữ liệu tác phẩm.",
    });
  }

  // Optional external analysis provider (must speak the same response shape)
  const externalProvider = process.env.MINTLY_AI_PROVIDER_URL;
  if (externalProvider) {
    try {
      const externalRes = await fetch(`${externalProvider}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(4000),
      });
      if (externalRes.ok) {
        return NextResponse.json(await externalRes.json());
      }
    } catch {
      // Fall back to the built-in engine
    }
  }

  try {
    return NextResponse.json(await analyzeArtwork(input));
  } catch (err) {
    console.error("analyzeArtwork failed:", err);
    return NextResponse.json({ error: "Could not analyse this image" }, { status: 422 });
  }
}
