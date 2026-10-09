import type { Connection } from "@solana/web3.js";
import { NETWORK } from "@/lib/config";
import { Lg } from "@/lib/i18n";

const GENESIS: Record<string, string> = {
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
  mainnet: "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
};

let verified: Promise<void> | null = null;

/**
 * Safety net before any transaction that moves value: the RPC must be the cluster this build targets
 * (Devnet by default). A misconfigured NEXT_PUBLIC_SOLANA_RPC_URL pointing at Mainnet would otherwise spend real SOL.
 */
export function assertExpectedCluster(connection: Connection): Promise<void> {
  const expected = GENESIS[NETWORK];
  if (!expected) return Promise.resolve(); // localnet / custom: nothing to compare against
  if (!verified) {
    verified = connection.getGenesisHash().then((hash) => {
      if (hash !== expected) {
        verified = null;
        throw new Error(
          Lg(
            `Kết nối RPC không phải Solana ${NETWORK}. Giao dịch bị chặn để tránh trừ SOL thật. Hãy kiểm tra NEXT_PUBLIC_SOLANA_RPC_URL.`,
            `The RPC endpoint is not Solana ${NETWORK}. The transaction was blocked to avoid spending real SOL. Check NEXT_PUBLIC_SOLANA_RPC_URL.`
          )
        );
      }
    });
    verified.catch(() => { verified = null; });
  }
  return verified;
}
