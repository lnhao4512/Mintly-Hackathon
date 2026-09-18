import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = pkg;
import fs from 'fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');
const idl = JSON.parse(fs.readFileSync('d:/189/FrontEnd/src/idl/mintly_marketplace.json', 'utf8'));

const winner = new PublicKey('EV7sZkb7DZzxPgQckP9y5MH9kz4j4LwfoEJycaN2fv8y');
const auctionPda = new PublicKey('7qXFPt1a4kZCdP51KA5aSbwo1GE7rcd2CojC2SN99283');

async function main() {
  const dummyWallet = {
    publicKey: winner,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  const provider = new AnchorProvider(conn, dummyWallet, {});
  const program = new Program(idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], PROGRAM_ID);
  const [bidCommitment] = PublicKey.findProgramAddressSync(
    [Buffer.from('bid-commitment'), auctionPda.toBuffer(), winner.toBuffer()],
    PROGRAM_ID
  );

  const tx = new Transaction();
  // Let's check commitment account
  const commitmentAcc = await program.account.bidCommitment.fetch(bidCommitment);
  console.log('On-chain commitment:', commitmentAcc.commitment);

  // We test reveal with arbitrary 32-byte secret
  const revealIx = await program.methods
    .revealBid(new BN(1_300_000_000), Array.from(new Uint8Array(32)))
    .accounts({
      bidder: winner,
      config: configPda,
      auction: auctionPda,
      bidCommitment,
    })
    .instruction();

  tx.add(revealIx);
  const latestBlockhash = await conn.getLatestBlockhash('confirmed');
  tx.feePayer = winner;
  tx.recentBlockhash = latestBlockhash.blockhash;

  const sim = await conn.simulateTransaction(tx);
  console.log('Reveal sim logs:', sim.value.logs);
  console.log('Reveal sim err:', sim.value.err);
}

main().catch(console.error);
