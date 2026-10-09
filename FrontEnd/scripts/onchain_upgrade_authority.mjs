// Prints the upgrade authority of the deployed program (who may run `anchor deploy`/upgrade).
import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const pid = new PublicKey("6HYc93V8Xzf6BYw8mTUgXZzpbJWrwuFQbw4BxRKYUgSA");
const prog = await conn.getAccountInfo(pid);
const pd = new PublicKey(prog.data.subarray(4, 36));
const data = (await conn.getAccountInfo(pd)).data;
console.log("program data account:", pd.toBase58());
console.log("upgrade authority:", data[12] === 1 ? new PublicKey(data.subarray(13, 45)).toBase58() : "none (immutable)");
