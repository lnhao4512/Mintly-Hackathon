import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Load IDL
const idlPath = path.resolve(__dirname, "../target/idl/mintly_marketplace.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));

// Wallet
const walletPath = process.env.WALLET_PATH || path.resolve(process.env.HOME || "/root", ".config/solana/id.json");
const rawKey = JSON.parse(fs.readFileSync(walletPath, "utf8"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(rawKey));

const rpcUrl = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(rpcUrl, "confirmed");

const wallet = new anchor.Wallet(keypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

const programId = new PublicKey(idl.address);
const program = new Program(idl, provider);

async function main() {
  console.log("Using deployer/authority:", keypair.publicKey.toBase58());
  console.log("Program ID:", programId.toBase58());
  console.log("RPC:", rpcUrl);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  console.log("Config PDA:", configPda.toBase58());

  // Check if config exists
  const configAccount = await connection.getAccountInfo(configPda);
  if (!configAccount) {
    console.log("Initializing Marketplace on-chain...");
    const treasury = keypair.publicKey;
    const forfeitureRecipient = keypair.publicKey;
    const feeBps = 250; // 2.5%

    const tx = await (program.methods as any)
      .initializeMarketplace(treasury, forfeitureRecipient, feeBps)
      .accounts({
        authority: keypair.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Marketplace initialized! Tx:", tx);
  } else {
    console.log("Marketplace is already initialized.");
  }

  // Whitelist Wrapped SOL (So11111111111111111111111111111111111111112)
  const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
  const [tokenConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token"), configPda.toBuffer(), WSOL_MINT.toBuffer()],
    programId
  );

  const tokenAccount = await connection.getAccountInfo(tokenConfigPda);
  if (!tokenAccount) {
    console.log("Whitelisting SOL/WSOL payment token on-chain...");
    const tx = await (program.methods as any)
      .addToken(WSOL_MINT, 9)
      .accounts({
        authority: keypair.publicKey,
        config: configPda,
        tokenConfig: tokenConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Token added! Tx:", tx);
  } else {
    console.log("SOL/WSOL payment token is already configured.");
  }

  console.log("=== ON-CHAIN INITIALIZATION COMPLETE ===");
}

main().catch((err) => {
  console.error("Initialization error:", err);
  process.exit(1);
});
