import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new PublicKey('EV7sZkb7DZzxPgQckP9y5MH9kz4j4LwfoEJycaN2fv8y');

async function main() {
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM_ID });
  console.log('Total token accounts for wallet:', tokenAccounts.value.length);
  for (const t of tokenAccounts.value) {
    const info = t.account.data.parsed.info;
    console.log('Token Account:', t.pubkey.toBase58());
    console.log('  Mint:', info.mint);
    console.log('  Amount:', info.tokenAmount.uiAmountString);
    console.log('  Decimals:', info.tokenAmount.decimals);
  }
}

main().catch(console.error);
