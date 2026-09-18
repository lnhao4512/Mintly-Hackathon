import { NextResponse } from "next/server";
import { analyzeArtwork, registerMintedArtwork } from "@/lib/visionSimilarity";

interface SimilarityRequest {
  action?: "analyze" | "register";
  imageData?: string;
  metadata?: { name?: string; description?: string; mint?: string };
}

export async function POST(request: Request) {
  let body: SimilarityRequest;
  try {
    body = (await request.json()) as SimilarityRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageData || typeof body.imageData !== "string") {
    return NextResponse.json({ error: "imageData is required" }, { status: 400 });
  }

  // Handle explicit indexing after on-chain minting
  if (body.action === "register") {
    const registered = registerMintedArtwork(body.imageData, body.metadata);
    return NextResponse.json({
      success: registered,
      message: registered
        ? "Tác phẩm đã được lưu vào hệ thống cơ sở dữ liệu để bảo vệ quyền tác giả."
        : "Không thể trích xuất dữ liệu tác phẩm.",
    });
  }

  // If external AI vector provider URL is configured, optionally proxy
  const externalProvider = process.env.MINTLY_AI_PROVIDER_URL;
  if (externalProvider) {
    try {
      const externalRes = await fetch(`${externalProvider}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: body.imageData, metadata: body.metadata }),
        signal: AbortSignal.timeout(4000),
      });
      if (externalRes.ok) {
        return NextResponse.json(await externalRes.json());
      }
    } catch {
      // Fall back to local perceptual AI engine
    }
  }

  // Execute real-time Computer Vision & AI Similarity analysis without persisting
  const result = analyzeArtwork(body.imageData, body.metadata);
  return NextResponse.json(result);
}
