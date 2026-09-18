import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { sha256Hex } from "@/lib/proof";
import BN from "bn.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { getMarketplaceProgram } from "@/utils/anchor";
import { getConfigPda } from "@/lib/config";

function normalizeSecret(secret: string): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode(secret).slice(0, 32));
  return bytes;
}

export async function createBidCommitment(amount: number, secret: string): Promise<{ commitment: number[]; secret: string }> {
  const normalizedAmount = new BN(Math.floor(amount)).toArrayLike(Uint8Array, "le", 8);
  const secretBytes = normalizeSecret(secret);
  const payload = new Uint8Array(normalizedAmount.length + secretBytes.length);
  payload.set(normalizedAmount);
  payload.set(secretBytes, normalizedAmount.length);
  const digest = await sha256Hex(payload);
  return {
    commitment: Array.from(Uint8Array.from(digest.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? [])),
    secret,
  };
}

export async function commitBidOnChain(
  connection: Parameters<typeof getMarketplaceProgram>[0],
  wallet: WalletContextState,
  auctionPda: PublicKey,
  commitment: number[]
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [config] = getConfigPda();
  const [bidCommitment] = PublicKey.findProgramAddressSync(
    [Buffer.from("bid-commitment"), auctionPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );

  const ix = await program.methods
    .commitBid(commitment)
    .accounts({
      bidder: wallet.publicKey,
      config,
      auction: auctionPda,
      bidCommitment,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  tx.add(ix);

  const signedTx = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return signature;
}

export async function revealBidOnChain(
  connection: Parameters<typeof getMarketplaceProgram>[0],
  wallet: WalletContextState,
  auctionPda: PublicKey,
  amount: number,
  secret: string
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [config] = getConfigPda();
  const [bidCommitment] = PublicKey.findProgramAddressSync(
    [Buffer.from("bid-commitment"), auctionPda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );
  const secretBytes = normalizeSecret(secret);
  return program.methods
    .revealBid(new BN(Math.floor(amount)), Array.from(secretBytes))
    .accounts({ bidder: wallet.publicKey, config, auction: auctionPda, bidCommitment })
    .rpc();
}
