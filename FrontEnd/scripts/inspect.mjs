import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const auctionPubkey = new PublicKey('7qXFPt1a4k2CdP51KA5aSbwo1GE7rcd2CqjC25N99283');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');

async function main() {
  const acc = await conn.getAccountInfo(auctionPubkey);
  console.log('Auction acc exists:', !!acc);
  const [escrowAuth] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), auctionPubkey.toBuffer()],
    PROGRAM_ID
  );
  console.log('escrowAuth:', escrowAuth.toBase58());
  const tokenAccs = await conn.getParsedTokenAccountsByOwner(escrowAuth, {
    programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  });
  console.log('Token accounts owned by escrowAuth:', JSON.stringify(tokenAccs.value.map(t => ({
    pubkey: t.pubkey.toBase58(),
    mint: t.account.data.parsed.info.mint,
    amount: t.account.data.parsed.info.tokenAmount.amount
  }))));
}

main().catch(console.error);
