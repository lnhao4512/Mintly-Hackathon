// Greps the deployed program binary for strings, to see which repo features were actually deployed.
import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const pid = new PublicKey("Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq");
const prog = await conn.getAccountInfo(pid);
const pd = new PublicKey(prog.data.subarray(4, 36));
const data = (await conn.getAccountInfo(pd)).data;
console.log("binary bytes", data.length, "last deploy slot", Number(data.readBigUInt64LE(4)));
const text = data.toString("latin1");
for (const k of ["seller_payment_account", "forfeiture_payment_account", "forfeiture_recipient", "SellerCannotBid", "AuctionStillActive", "AuctionEnded", "refund", "DepositDeadlinePassed", "DefaultWinner", "default_winner"]) {
  console.log(k.padEnd(28), text.includes(k));
}
