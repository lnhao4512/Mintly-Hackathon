// Debug: simulate create_auction for the mint of an existing (cancelled) auction, as its seller, without signing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchorPkg from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../src/idl/mintly_marketplace.json"), "utf8"));
const conn = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
const dummy = Keypair.generate();
const program = new Program(idl, new AnchorProvider(conn, new Wallet(dummy), {}));
const pid = program.programId;
const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

const prefix = process.argv[2];
const all = await program.account.auction.all();
const old = all.find((x) => x.publicKey.toBase58().startsWith(prefix));
const seller = old.account.seller;
const nftMint = old.account.nftMint;
console.log("seller", seller.toBase58(), "mint", nftMint.toBase58());
const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], pid);
const [tokenConfig] = PublicKey.findProgramAddressSync([Buffer.from("token"), config.toBuffer(), WSOL.toBuffer()], pid);
const [auction] = PublicKey.findProgramAddressSync([Buffer.from("auction"), nftMint.toBuffer()], pid);
const [escrowAuthority] = PublicKey.findProgramAddressSync([Buffer.from("escrow"), auction.toBuffer()], pid);
const escrow = Keypair.generate();
const sellerTokenAccount = getAssociatedTokenAddressSync(nftMint, seller);
console.log("seller NFT balance", JSON.stringify((await conn.getTokenAccountBalance(sellerTokenAccount).catch((e) => e.message))?.value?.uiAmount));
const now = Math.floor(Date.now() / 1000);
const ix = await program.methods
  .createAuction(new BN(100_000_000), new BN(50_000_000), new BN(now - 30), new BN(now + 86400), new BN(now + 2 * 86400), new BN(now + 3 * 86400), new BN(now + 5 * 86400))
  .accounts({ seller, config, tokenConfig, nftMint, paymentMint: WSOL, sellerTokenAccount, auction, escrowAuthority, escrowTokenAccount: escrow.publicKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId })
  .instruction();
const tx = new Transaction({ feePayer: seller, recentBlockhash: (await conn.getLatestBlockhash()).blockhash }).add(ix);
tx.partialSign(escrow);
const sim = await conn.simulateTransaction(tx);
console.log(JSON.stringify(sim.value.err), "\n" + (sim.value.logs || []).join("\n"));
