// Prints which instruction accounts the DEPLOYED program's on-chain IDL declares (to compare with the repo source).
import anchorPkg from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
const { AnchorProvider, Program, Wallet } = anchorPkg;
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const pid = new PublicKey("Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq");
const idl = await Program.fetchIdl(pid, new AnchorProvider(conn, new Wallet(Keypair.generate()), {}));
if (!idl) { console.log("no on-chain IDL"); process.exit(0); }
for (const n of ["default_winner", "place_bid", "pay_balance"]) {
  const ix = idl.instructions.find((i) => i.name === n);
  console.log(n, ix ? ix.accounts.map((a) => a.name).join(", ") : "-");
}
console.log("constants:", JSON.stringify(idl.constants ?? []));
console.log("errors:", (idl.errors ?? []).map((e) => e.name).join(", "));
