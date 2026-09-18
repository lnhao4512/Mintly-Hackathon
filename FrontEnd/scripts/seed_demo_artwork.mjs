import anchorPkg from "@coral-xyz/anchor";
const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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
const [tokenConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("token"), configPda.toBuffer(), WSOL_MINT.toBuffer()],
  programId
);

async function seed() {
  console.log("=== Seeding Initial On-Chain Artwork & Auction ===");

  // 1. Create NFT Mint 1 (for Direct Listing)
  console.log("Minting NFT 1...");
  const nftMint1 = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0);
  console.log("NFT 1 Mint Address:", nftMint1.toBase58());

  const payerAta1 = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    nftMint1,
    payer.publicKey
  );
  await mintTo(connection, payer, nftMint1, payerAta1.address, payer, 1);
  console.log("Minted 1 NFT into ATA:", payerAta1.address.toBase58());

  // 2. Create Listing on-chain
  const [listingPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), nftMint1.toBuffer()],
    programId
  );
  const [listingEscrowAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), listingPda.toBuffer()],
    programId
  );
  const listingEscrowNftAccount = Keypair.generate();

  const now = Math.floor(Date.now() / 1000);
  const expiry = new BN(now + 86400 * 14); // 14 days
  const price = new BN(2_500_000_000); // 2.5 SOL

  console.log("Creating on-chain listing for NFT 1...");
  const txListing = await program.methods
    .createListing(price, expiry)
    .accounts({
      seller: payer.publicKey,
      config: configPda,
      tokenConfig: tokenConfigPda,
      nftMint: nftMint1,
      paymentMint: WSOL_MINT,
      sellerTokenAccount: payerAta1.address,
      listing: listingPda,
      escrowAuthority: listingEscrowAuth,
      escrowNftAccount: listingEscrowNftAccount.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([listingEscrowNftAccount])
    .rpc();

  console.log("Listing created successfully! Tx:", txListing);
  console.log("Listing PDA:", listingPda.toBase58());

  // 3. Create NFT Mint 2 (for Live Auction)
  console.log("\nMinting NFT 2 for Auction...");
  const nftMint2 = await createMint(connection, payer, payer.publicKey, payer.publicKey, 0);
  console.log("NFT 2 Mint Address:", nftMint2.toBase58());

  const payerAta2 = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    nftMint2,
    payer.publicKey
  );
  await mintTo(connection, payer, nftMint2, payerAta2.address, payer, 1);
  console.log("Minted 1 NFT into ATA:", payerAta2.address.toBase58());

  // 4. Create Auction on-chain
  const [auctionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("auction"), nftMint2.toBuffer()],
    programId
  );
  const [auctionEscrowAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), auctionPda.toBuffer()],
    programId
  );
  const auctionEscrowNftAccount = Keypair.generate();

  const startPrice = new BN(1_200_000_000); // 1.2 SOL
  const minIncrement = new BN(100_000_000); // 0.1 SOL
  const startTime = new BN(now - 120); // Started 2 mins ago
  const endTime = new BN(now + 86400 * 3); // Ends in 3 days
  const depositDeadline = new BN(now + 86400 * 5); // 5 days
  const paymentDeadline = new BN(now + 86400 * 7); // 7 days

  console.log("Creating on-chain auction for NFT 2...");
  const txAuction = await program.methods
    .createAuction(
      startPrice,
      minIncrement,
      startTime,
      endTime,
      depositDeadline,
      paymentDeadline
    )
    .accounts({
      seller: payer.publicKey,
      config: configPda,
      tokenConfig: tokenConfigPda,
      nftMint: nftMint2,
      paymentMint: WSOL_MINT,
      sellerTokenAccount: payerAta2.address,
      auction: auctionPda,
      escrowAuthority: auctionEscrowAuth,
      escrowNftAccount: auctionEscrowNftAccount.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([auctionEscrowNftAccount])
    .rpc();

  console.log("Auction created successfully! Tx:", txAuction);
  console.log("Auction PDA:", auctionPda.toBase58());

  // 5. Query all listings and auctions to verify
  const allListings = await program.account.listing.all();
  console.log(`\nVerified On-chain Listings Count: ${allListings.length}`);
  const allAuctions = await program.account.auction.all();
  console.log(`Verified On-chain Auctions Count: ${allAuctions.length}`);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
