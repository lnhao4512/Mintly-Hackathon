// Loads the signer keypair for the admin/seed scripts from a JSON file OUTSIDE the repository.
// SOLANA_KEYPAIR=<path> (defaults to the Solana CLI keypair at ~/.config/solana/id.json).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

export function loadKeypair() {
  const file = process.env.SOLANA_KEYPAIR || path.join(os.homedir(), ".config", "solana", "id.json");
  if (!fs.existsSync(file)) {
    console.error(`Keypair file not found: ${file}\nSet SOLANA_KEYPAIR=<path to a Solana keypair JSON>.`);
    process.exit(1);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf-8"))));
}
