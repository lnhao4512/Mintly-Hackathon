export interface ArtworkSimilarityResult {
  status: "LOW_SIMILARITY" | "HIGH_SIMILARITY" | "MODERATE_SIMILARITY" | "PENDING_PROVIDER" | "UNAVAILABLE";
  similarity: number | null;
  originalityScore?: number | null;
  potentialDuplicate: boolean | null;
  visualSimilarity?: number | null;
  colorSimilarity?: number | null;
  semanticSimilarity?: number | null;
  dominantColors?: string[];
  complexityScore?: number | null;
  closestMatch?: {
    title: string;
    similarity: number;
    category?: string;
  } | null;
  similarItems: Array<{ mint: string; similarity: number; title?: string; reason?: string }>;
  metadataAnalysis: string | null;
  provenanceAnalysis: string | null;
  potentialAnomalies?: string[];
  evidence: Array<{ type: string; value: string }>;
  message: string;
}

export async function analyzeArtworkSimilarity(
  imageData: string,
  metadata: { name?: string; description?: string }
): Promise<ArtworkSimilarityResult> {
  const response = await fetch("/api/ai/similarity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "analyze", imageData, metadata }),
  });

  if (!response.ok) {
    throw new Error(`AI similarity request failed with status ${response.status}`);
  }

  return response.json() as Promise<ArtworkSimilarityResult>;
}

export async function registerMintedArtworkAI(
  imageData: string,
  metadata: { name?: string; description?: string; mint?: string }
): Promise<boolean> {
  try {
    const response = await fetch("/api/ai/similarity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "register", imageData, metadata }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
