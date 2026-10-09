// Prints the on-chain MarketplaceConfig (fee, deposit bps, authority) of the deployed program.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchorPkg from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
const { AnchorProvider, Program, Wallet } = anchorPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/idl/mintly_marketplace.json"), "utf8"));
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const program = new Program(idl, new AnchorProvider(conn, new Wallet(Keypair.generate()), {}));
const [cfg] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
const c = await program.account.marketplaceConfig.fetch(cfg);
console.log(JSON.stringify(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v?.toBase58 ? v.toBase58() : v?.toString?.() ?? v])), null, 1));
