import type { WalletContextState } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { createArtworkProof, type CreationProof } from "@/lib/proof";
import { NETWORK } from "@/lib/config";

export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  attributes: { trait_type: string; value: string }[];
  properties: {
    files: { uri: string; type: string }[];
    category: string;
    creators: { address: string; share: number }[];
  };
  proof?: CreationProof;
}

export type NftProperties = NftMetadata["properties"];

export async function mockUploadToIPFS(_payload: string): Promise<string> {
  const encoded = typeof window === "undefined"
    ? Buffer.from(_payload).toString("base64")
    : window.btoa(unescape(encodeURIComponent(_payload)));
  return `data:application/json;base64,${encoded}`;
}

export function createNftMetadata(
  title: string,
  description: string,
  imageUrl: string,
  creatorAddress: string,
  properties?: NftProperties
): NftMetadata {
  return {
    name: title || "Untitled Opus",
    symbol: "MNTLY",
    description: description || "A digital artifact minted on MINTLY Canvas Studio.",
    image: imageUrl,
    attributes: [
      { trait_type: "Medium", value: "Digital" },
      { trait_type: "Platform", value: "MINTLY" },
    ],
    properties: properties ?? {
      files: [{ uri: imageUrl, type: "image/png" }],
      category: "image",
      creators: [{ address: creatorAddress, share: 100 }],
    },
  };
}

function normalizeMintError(error: unknown): string {
  if (error instanceof WalletError) {
    const message = error.message.toLowerCase();
    if (message.includes("reject") || message.includes("cancel") || message.includes("close")) {
      return "Transaction rejected by user";
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("user rejected") ||
      message.includes("rejected") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    ) {
      return "Transaction rejected by user";
    }
    return error.message;
  }

  return "Minting failed";
}

/**
 * Mints an on-chain 1-of-1 NFT directly on Solana using standard SPL Token.
 * Fully compatible with the Mintly Marketplace smart contract escrow.
 */
export async function mintNFT(
  connection: Connection,
  wallet: WalletContextState,
  base64Image: string,
  title: string,
  description: string,
  creator: string,
  properties?: NftProperties,
  onProgress?: (step: "preparing" | "awaiting-wallet" | "confirming" | "success") => void
): Promise<{ signature: string; mintAddress: string; metadataUri: string; metadata: NftMetadata; proof: CreationProof }> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const creatorAddress = creator || wallet.publicKey.toBase58();
  const metadataPayload = createNftMetadata(title, description, base64Image, creatorAddress, properties);

  const proof = await createArtworkProof({
    base64Image,
    metadata: metadataPayload,
    creatorWallet: creatorAddress,
    network: NETWORK,
  });
  metadataPayload.proof = proof;

  onProgress?.("preparing");

  const metadataUri = await mockUploadToIPFS(
    JSON.stringify({
      ...metadataPayload,
      creator: creatorAddress,
    })
  );

  onProgress?.("awaiting-wallet");

  const mintKeypair = Keypair.generate();
  const lamportsForRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);

  const ata = getAssociatedTokenAddressSync(
    mintKeypair.publicKey,
    wallet.publicKey
  );

  const tx = new Transaction().add(
    // 1. Create Mint Account
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports: lamportsForRent,
      programId: TOKEN_PROGRAM_ID,
    }),
    // 2. Initialize Mint (decimals: 0 for 1-of-1 NFT)
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      0,
      wallet.publicKey,
      wallet.publicKey
    ),
    // 3. Create Creator Associated Token Account
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      ata,
      wallet.publicKey,
      mintKeypair.publicKey
    ),
    // 4. Mint 1 token (NFT supply: 1)
    createMintToInstruction(
      mintKeypair.publicKey,
      ata,
      wallet.publicKey,
      1
    )
  );

  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  tx.feePayer = wallet.publicKey;
  tx.partialSign(mintKeypair);

  onProgress?.("confirming");

  try {
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    onProgress?.("success");

    return {
      signature,
      mintAddress: mintKeypair.publicKey.toBase58(),
      metadataUri,
      metadata: metadataPayload,
      proof,
    };
  } catch (error) {
    throw new Error(normalizeMintError(error));
  }
}
