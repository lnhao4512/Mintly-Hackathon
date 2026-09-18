import anchorPkg from "@coral-xyz/anchor";
const { AnchorProvider, Program, Wallet } = anchorPkg;
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");
const dummyKeypair = Keypair.generate();
const dummyWallet = new Wallet(dummyKeypair);
const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });

const idlPath = path.resolve(__dirname, "../src/idl/mintly_marketplace.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
const program = new Program(idl, provider);

async function check() {
  const listings = await program.account.listing.all();
  console.log("Listings count:", listings.length);
  for (const l of listings) {
    console.log("Listing:", {
      pubkey: l.publicKey.toBase58(),
      seller: l.account.seller.toBase58(),
      nftMint: l.account.nftMint.toBase58(),
      price: l.account.price.toString(),
      status: l.account.status,
    });
  }

  const auctions = await program.account.auction.all();
  console.log("Auctions count:", auctions.length);
  for (const a of auctions) {
    console.log("Auction:", {
      pubkey: a.publicKey.toBase58(),
      seller: a.account.seller.toBase58(),
      nftMint: a.account.nftMint.toBase58(),
      startPrice: a.account.startPrice.toString(),
      currentBid: a.account.currentBid.toString(),
      status: a.account.status,
    });
  }
}

check().catch(console.error);
