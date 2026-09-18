import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider } = pkg;
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import fs from 'fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const idl = JSON.parse(fs.readFileSync('d:/189/FrontEnd/src/idl/mintly_marketplace.json', 'utf8'));

const winner = new PublicKey('EV7sZkb7DZzxPgQckP9y5MH9kz4j4LwfoEJycaN2fv8y');
const auctionPda = new PublicKey('7qXFPt1a4kZCdP51KA5aSbwo1GE7rcd2CojC2SN99283');
const nftMint = new PublicKey('5YN88qR8W8vNojBUHLhBu3dUsE7iQKfWeWPaEWTgyJZM');
const seller = new PublicKey('7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX');
const treasury = new PublicKey('7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX');

async function main() {
  const dummyWallet = {
    publicKey: winner,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const provider = new AnchorProvider(conn, dummyWallet, {});
  const program = new Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const [escrowAuthority] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), auctionPda.toBuffer()], PROGRAM_ID);

  const winnerPaymentAccount = getAssociatedTokenAddressSync(WSOL_MINT, winner);
  const winnerNftAccount = getAssociatedTokenAddressSync(nftMint, winner);
  const treasuryPaymentAccount = getAssociatedTokenAddressSync(WSOL_MINT, treasury);
  const sellerPaymentAccount = getAssociatedTokenAddressSync(WSOL_MINT, seller);
  const escrowPaymentAccount = getAssociatedTokenAddressSync(WSOL_MINT, escrowAuthority, true);

  const tokenAccs = await conn.getParsedTokenAccountsByOwner(escrowAuthority, { mint: nftMint });
  const escrowNftAccount = tokenAccs.value[0]?.pubkey;
  console.log('escrowNftAccount:', escrowNftAccount?.toBase58());

  const instructions = [];

  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(winner, winnerPaymentAccount, winner, WSOL_MINT),
    createAssociatedTokenAccountIdempotentInstruction(winner, winnerNftAccount, winner, nftMint),
    createAssociatedTokenAccountIdempotentInstruction(winner, treasuryPaymentAccount, treasury, WSOL_MINT),
    createAssociatedTokenAccountIdempotentInstruction(winner, sellerPaymentAccount, seller, WSOL_MINT),
    createAssociatedTokenAccountIdempotentInstruction(winner, escrowPaymentAccount, escrowAuthority, WSOL_MINT),
    SystemProgram.transfer({ fromPubkey: winner, toPubkey: winnerPaymentAccount, lamports: 1_300_000_000 }),
    createSyncNativeInstruction(winnerPaymentAccount)
  );

  console.log('Testing simulation...');
  const latestBlockhash = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({
    feePayer: winner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((ix) => tx.add(ix));

  if (escrowNftAccount) {
    const payBalanceIx = await program.methods
      .payBalance()
      .accounts({
        winner,
        config: configPda,
        auction: auctionPda,
        winnerPaymentAccount,
        escrowAuthority,
        escrowPaymentAccount,
        escrowNftAccount,
        winnerNftAccount,
        treasuryPaymentAccount,
        sellerPaymentAccount,
        paymentMint: WSOL_MINT,
        nftMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    tx.add(payBalanceIx);
  }

  const sim = await conn.simulateTransaction(tx);
  console.log('Simulation logs:');
  console.log(JSON.stringify(sim.value.logs, null, 2));
  console.log('Simulation err:', sim.value.err);
}

main().catch(console.error);
