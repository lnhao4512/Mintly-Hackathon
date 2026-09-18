import { Connection, Keypair } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import idl from "@/idl/mintly_marketplace.json";
import { PROGRAM_ID } from "@/lib/config";

// Read-only dummy keypair for anonymous visitors
const dummyKeypair = Keypair.generate();
const dummyWallet = {
  publicKey: dummyKeypair.publicKey,
  payer: dummyKeypair,
  signTransaction: async (tx: any) => tx,
  signAllTransactions: async (txs: any) => txs,
};

function getAnchorLib() {
  if (typeof globalThis !== "undefined") {
    const g = globalThis as any;
    if (!g.exports) g.exports = {};
    if (!g.module) g.module = { exports: g.exports };
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@coral-xyz/anchor");
}

/**
 * Initializes and returns an AnchorProvider based on the current connection and wallet.
 */
export function getAnchorProvider(
  connection: Connection,
  wallet?: WalletContextState | null
): any {
  const { AnchorProvider, setProvider } = getAnchorLib();
  if (wallet?.publicKey && wallet.signTransaction && wallet.signAllTransactions) {
    const anchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
    };
    const provider = new AnchorProvider(
      connection,
      anchorWallet as any,
      AnchorProvider.defaultOptions()
    );
    setProvider(provider);
    return provider;
  }

  // Fallback to read-only provider
  return new AnchorProvider(
    connection,
    dummyWallet as any,
    AnchorProvider.defaultOptions()
  );
}

/**
 * Returns the Mintly Marketplace Anchor Program instance.
 */
export function getMarketplaceProgram(
  connection: Connection,
  wallet?: WalletContextState | null
): any {
  const { Program } = getAnchorLib();
  const provider = getAnchorProvider(connection, wallet);
  const programIdl = { ...(idl as Record<string, unknown>), address: PROGRAM_ID.toBase58() };
  return new Program(programIdl as any, provider);
}
