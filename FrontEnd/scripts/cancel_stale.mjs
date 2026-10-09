// Cancel the sim seller's LIVE auctions that never received a bid (NFT returns to the seller).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchorPkg from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

const { AnchorProvider, Program, Wallet } = anchorPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/idl/mintly_marketplace.json"), "utf8"));
const w = JSON.parse(fs.readFileSync(path.join(__dirname, ".sim-wallets.json"), "utf8"));
const seller = Keypair.fromSecretKey(Uint8Array.from(w.seller));
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const program = new Program(idl, new AnchorProvider(conn, new Wallet(seller), {}));

const all = await program.account.auction.all([{ memcmp: { offset: 8, bytes: seller.publicKey.toBase58() } }]);
const stale = all.filter((x) => x.account.status.live !== undefined && !x.account.highestBidder);
console.log(`${stale.length} bid-less live auction(s) to cancel`);
for (const x of stale) {
  const auction = x.publicKey;
  const nftMint = x.account.nftMint;
  const [escrowAuthority] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), auction.toBuffer()], program.programId);
  const escrowNftAccount = (await conn.getParsedTokenAccountsByOwner(escrowAuthority, { mint: nftMint })).value[0].pubkey;
  const sellerNftAccount = getAssociatedTokenAddressSync(nftMint, seller.publicKey);
  await sendAndConfirmTransaction(conn, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(seller.publicKey, sellerNftAccount, seller.publicKey, nftMint)), [seller]);
  const sig = await program.methods
    .cancelAuction()
    .accounts({ seller: seller.publicKey, auction, escrowAuthority, escrowNftAccount, sellerNftAccount, tokenProgram: TOKEN_PROGRAM_ID })
    .rpc();
  console.log("cancelled", auction.toBase58().slice(0, 8), sig.slice(0, 12));
}
