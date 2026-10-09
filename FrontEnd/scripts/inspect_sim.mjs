// Debug helper: print status/bid/end time of every auction created by the sim seller.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchorPkg from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";

const { AnchorProvider, Program, Wallet } = anchorPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/idl/mintly_marketplace.json"), "utf8"));
const w = JSON.parse(fs.readFileSync(path.join(__dirname, ".sim-wallets.json"), "utf8"));
const kp = Keypair.fromSecretKey(Uint8Array.from(w.seller ?? w.sellerSecret ?? Object.values(w)[0]));
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const program = new Program(idl, new AnchorProvider(conn, new Wallet(kp), {}));
const all = process.env.ALL ? await program.account.auction.all() : await program.account.auction.all([{ memcmp: { offset: 8, bytes: kp.publicKey.toBase58() } }]);
for (const x of all) {
  const a = x.account;
  console.log(x.publicKey.toBase58().slice(0, 8), JSON.stringify(a.status), "bid", a.currentBid.toString(), "dep", a.depositPaid.toString(),
    "end", new Date(a.endTime.toNumber() * 1000).toISOString(), "hb", a.highestBidder?.toBase58().slice(0, 6));
}
console.log("now", new Date().toISOString());
