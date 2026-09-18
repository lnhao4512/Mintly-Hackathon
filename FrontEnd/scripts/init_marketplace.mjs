import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = process.env.SOLANA_RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");

// Keypair array from /root/.config/solana/id.json
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

async function main() {
  console.log("Payer / Admin Pubkey:", payer.publicKey.toBase58());
  console.log("Config PDA:", configPda.toBase58());
  console.log("Token Config PDA:", tokenConfigPda.toBase58());

  // Check if config already initialized
  const configAccountInfo = await connection.getAccountInfo(configPda);
  if (!configAccountInfo) {
    console.log("Initializing marketplace...");
    const tx = await program.methods
      .initializeMarketplace(payer.publicKey, payer.publicKey, 250) // 2.5% fee
      .accounts({
        authority: payer.publicKey,
        config: configPda,
        systemProgram: PublicKey.default,
      })
      .rpc();
    console.log("Marketplace initialized successfully! Tx:", tx);
  } else {
    console.log("Marketplace config already initialized!");
  }

  // Check if WSOL token config exists
  const tokenAccountInfo = await connection.getAccountInfo(tokenConfigPda);
  if (!tokenAccountInfo) {
    console.log("Adding WSOL payment token...");
    const txToken = await program.methods
      .addToken(WSOL_MINT, 9)
      .accounts({
        authority: payer.publicKey,
        config: configPda,
        tokenConfig: tokenConfigPda,
        systemProgram: PublicKey.default,
      })
      .rpc();
    console.log("WSOL payment token added! Tx:", txToken);
  } else {
    console.log("WSOL token config already exists!");
  }

  // Fetch and display config
  const config = await program.account.marketplaceConfig.fetch(configPda);
  console.log("Marketplace Config:", {
    authority: config.authority.toBase58(),
    treasury: config.treasury.toBase58(),
    feeBps: config.feeBps,
    depositBps: config.depositBps,
    paused: config.paused,
  });
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
