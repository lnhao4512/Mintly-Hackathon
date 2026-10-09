import type { WalletContextState } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
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

/** SPL Memo program — used to anchor the creation-proof hash on-chain inside the mint transaction. */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function creationProofMemo(mint: string, proofHash: string, method: string): string {
  return `MINTLY:proof:v1:${mint}:${method}:${proofHash}`;
}

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

/** A title is mandatory; never invent one. */
function requireTitle(title: string): string {
  const t = title?.trim();
  if (!t) throw new Error("Artwork title is required");
  return t;
}

export function createNftMetadata(
  title: string,
  description: string,
  imageUrl: string,
  creatorAddress: string,
  properties?: NftProperties,
  extraAttributes: NftMetadata["attributes"] = []
): NftMetadata {
  return {
    name: requireTitle(title),
    symbol: "MNTLY",
    description: description?.trim() || "",
    image: imageUrl,
    attributes: [
      { trait_type: "Medium", value: "Digital" },
      { trait_type: "Platform", value: "MINTLY" },
      ...extraAttributes,
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
  onProgress?: (step: "preparing" | "awaiting-wallet" | "confirming" | "success") => void,
  extraAttributes?: NftMetadata["attributes"],
  creationProof?: { hash: string; method: string }
): Promise<{ signature: string; mintAddress: string; metadataUri: string; metadata: NftMetadata; proof: CreationProof }> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const creatorAddress = creator || wallet.publicKey.toBase58();
  const metadataPayload = createNftMetadata(title, description, base64Image, creatorAddress, properties, extraAttributes);

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

  if (creationProof) {
    // 5. Anchor the creation-proof hash on-chain (SPL Memo, signed by the creator)
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(creationProofMemo(mintKeypair.publicKey.toBase58(), creationProof.hash, creationProof.method), "utf-8"),
      })
    );
  }

  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  tx.feePayer = wallet.publicKey;
  tx.partialSign(mintKeypair);

  onProgress?.("confirming");

  try {
    const signature = await wallet.sendTransaction(tx, connection, { signers: [mintKeypair] });
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
