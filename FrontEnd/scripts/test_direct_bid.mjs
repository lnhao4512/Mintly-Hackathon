import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import pkg from '@coral-xyz/anchor';
const { Program, AnchorProvider, BN } = pkg;
import fs from 'fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');
const idl = JSON.parse(fs.readFileSync('d:/189/FrontEnd/src/idl/mintly_marketplace.json', 'utf8'));

// Winner wallet
const winner = new PublicKey('EV7sZkb7DZzxPgQckP9y5MH9kz4j4LwfoEJycaN2fv8y');
const auctionPda = new PublicKey('49BsRGMfjWTpovhC61vcEsqtCdM7ZWc6w57h22tmF4r4');

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

  const commitmentAcc = await program.account.bidCommitment.fetch(bidCommitment);
  console.log('Stored on-chain commitment:', commitmentAcc.commitment);

  // Let's check revealBid with secret
  const revealIx = await program.methods
    .revealBid(new BN(1_300_000_000), Array.from(new Uint8Array(32)))
    .accounts({
      bidder: winner,
      config: configPda,
      auction: auctionPda,
      bidCommitment,
    })
    .instruction();

  const latestBlockhash = await conn.getLatestBlockhash('confirmed');
  const tx = new Transaction({
    feePayer: winner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  tx.add(revealIx);

  console.log('Simulating reveal for live auction...');
  const sim = await conn.simulateTransaction(tx);
  console.log('Sim logs:', sim.value.logs);
  console.log('Sim err:', sim.value.err);
}

main().catch(console.error);
