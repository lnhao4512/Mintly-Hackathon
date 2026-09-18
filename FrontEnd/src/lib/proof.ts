export interface CreationProof {
  artworkHash: string;
  metadataHash: string;
  creatorWallet: string;
  createdAt: string;
  network: string;
  canonicalization: "base64-image-v1";
}

function toBytes(value: string): Uint8Array {
  if (typeof window !== "undefined") {
    const binary = window.atob(value.replace(/^data:[^;]+;base64,/, ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(value.replace(/^data:[^;]+;base64,/, ""), "base64"));
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return toHex(digest);
}

export async function createArtworkProof({
  base64Image,
  metadata,
  creatorWallet,
  network,
}: {
  base64Image: string;
  metadata: unknown;
  creatorWallet: string;
  network: string;
}): Promise<CreationProof> {
  const artworkHash = await sha256Hex(toBytes(base64Image));
  const canonicalMetadata = JSON.stringify(stripProof(metadata));
  const metadataHash = await sha256Hex(canonicalMetadata);

  return {
    artworkHash,
    metadataHash,
    creatorWallet,
    createdAt: new Date().toISOString(),
    network,
    canonicalization: "base64-image-v1",
  };
}

export async function verifyArtworkProof(
  base64Image: string,
  metadata: unknown,
  proof: CreationProof
): Promise<{ artworkMatch: boolean; metadataMatch: boolean; verified: boolean }> {
  const artworkHash = await sha256Hex(toBytes(base64Image));
  const metadataHash = await sha256Hex(JSON.stringify(stripProof(metadata)));
  const artworkMatch = artworkHash === proof.artworkHash;
  const metadataMatch = metadataHash === proof.metadataHash;

  return { artworkMatch, metadataMatch, verified: artworkMatch && metadataMatch };
}

function stripProof(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata;
  const copy = { ...(metadata as Record<string, unknown>) };
  delete copy.proof;
  return copy;
}
