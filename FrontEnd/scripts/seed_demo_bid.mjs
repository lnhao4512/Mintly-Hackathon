import anchorPkg from "@coral-xyz/anchor";
const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  syncNative,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");

// Deployer keypair
const secretKey = new Uint8Array([
  26,196,206,217,156,1,204,78,218,241,216,54,236,243,37,126,
  10,63,128,145,64,186,191,154,154,48,212,2,101,134,121,222,
  17,98,96,70,186,160,19,197,55,64,58,74,244,216,230,17,
  135,155,10,127,115,235,247,251,241,179,0,175,0,80,244,59
]);
const payer = Keypair.fromSecretKey(secretKey);
const wallet = new Wallet(payer);

const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
const idlPath = path.resolve(__dirname, "../src/idl/mintly_marketplace.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
const programId = new PublicKey("Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq");
const program = new Program(idl, provider);

const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

async function seedBid() {
  console.log("=== Placing Real On-Chain Bid ===");
  const auctions = await program.account.auction.all();
  if (auctions.length === 0) {
    console.log("No auctions found to bid on!");
    return;
  }
  const auction = auctions[0];
  console.log("Target Auction PDA:", auction.publicKey.toBase58());
  console.log("Current Bid:", auction.account.currentBid.toString());

  // 1. Create a dedicated bidder keypair and airdrop SOL
  const bidder = Keypair.generate();
  const airdropSig = await connection.requestAirdrop(bidder.publicKey, 10 * 1e9);
  await connection.confirmTransaction(airdropSig);
  console.log("Bidder created:", bidder.publicKey.toBase58());

  // 2. Wrap 2 SOL into WSOL for the bidder
  const bidderWsolAta = await getOrCreateAssociatedTokenAccount(
    connection,
    bidder,
    WSOL_MINT,
    bidder.publicKey
  );
  const wrapTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: bidder.publicKey,
      toPubkey: bidderWsolAta.address,
      lamports: 2 * 1e9,
    })
  );
  await provider.sendAndConfirm(wrapTx, [bidder]);
  await syncNative(connection, bidder, bidderWsolAta.address);
  console.log("Wrapped 2 SOL into WSOL ATA:", bidderWsolAta.address.toBase58());

  // 3. Place Bid
  const [bidPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), auction.publicKey.toBuffer(), bidder.publicKey.toBuffer()],
    programId
  );
  const [escrowAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), auction.publicKey.toBuffer()],
    programId
  );
  const escrowPaymentAccount = Keypair.generate();

  const bidAmount = new BN(1_500_000_000); // 1.5 SOL
  const bidderProvider = new AnchorProvider(
    connection,
    new Wallet(bidder),
    { commitment: "confirmed" }
  );
  const bidderProgram = new Program(idl, bidderProvider);

  console.log("Placing bid for 1.5 SOL...");
  const tx = await bidderProgram.methods
    .placeBid(bidAmount)
    .accounts({
      bidder: bidder.publicKey,
      config: configPda,
      auction: auction.publicKey,
      bid: bidPda,
      bidderPaymentAccount: bidderWsolAta.address,
      escrowAuthority,
      escrowPaymentAccount: escrowPaymentAccount.publicKey,
      paymentMint: WSOL_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([bidder, escrowPaymentAccount])
    .rpc();

  console.log("Bid placed successfully! Tx:", tx);

  // 4. Verify updated auction state
  const updatedAuction = await program.account.auction.fetch(auction.publicKey);
  console.log("Updated Auction State:", {
    currentBid: (updatedAuction.currentBid.toNumber() / 1e9).toFixed(2) + " SOL",
    highestBidder: updatedAuction.highestBidder?.toBase58(),
  });
}

seedBid().catch((err) => {
  console.error("Bid placement failed:", err);
  process.exit(1);
});
