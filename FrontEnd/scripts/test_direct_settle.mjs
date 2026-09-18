import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token';
import fs from 'fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');

// Winner wallet
const winner = new PublicKey('EV7sZkb7DZzxPgQckP9y5MH9kz4j4LwfoEJycaN2fv8y');
const auctionPda = new PublicKey('7qXFPt1a4kZCdP51KA5aSbwo1GE7rcd2CojC2SN99283');
const nftMint = new PublicKey('5YN88qR8W8vNojBUHLhBu3dUsE7iQKfWeWPaEWTgyJZM');
const seller = new PublicKey('7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX');
const treasury = new PublicKey('7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX');

async function main() {
  const [escrowAuthority] = PublicKey.findProgramAddressSync([Buffer.from('escrow'), auctionPda.toBuffer()], PROGRAM_ID);
  const winnerNftAccount = getAssociatedTokenAddressSync(nftMint, winner);

  const tokenAccs = await conn.getParsedTokenAccountsByOwner(escrowAuthority, { mint: nftMint });
  const escrowNftAccount = tokenAccs.value[0]?.pubkey;
  console.log('escrowNftAccount:', escrowNftAccount?.toBase58());

  const totalAmountLamports = 1_300_000_000; // 1.30 SOL
  const feeLamports = Math.floor(totalAmountLamports * 0.025); // 2.5% fee
  const sellerLamports = totalAmountLamports - feeLamports;

  const tx = new Transaction();

  // 1. Ensure Winner NFT ATA
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      winner,
      winnerNftAccount,
      winner,
      nftMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 2. Direct SOL transfers (deducts 1.30 SOL from winner: fee to treasury, proceeds to seller)
  if (feeLamports > 0) {
    tx.add(
      SystemProgram.transfer({
        fromPubkey: winner,
        toPubkey: treasury,
        lamports: feeLamports,
      })
    );
  }

  tx.add(
    SystemProgram.transfer({
      fromPubkey: winner,
      toPubkey: seller,
      lamports: sellerLamports,
    })
  );

  const latestBlockhash = await conn.getLatestBlockhash('confirmed');
  tx.feePayer = winner;
  tx.recentBlockhash = latestBlockhash.blockhash;

  console.log('Simulating direct 1.30 SOL settlement transfer...');
  const sim = await conn.simulateTransaction(tx);
  console.log('Sim logs:', sim.value.logs);
  console.log('Sim err:', sim.value.err);
}

main().catch(console.error);
