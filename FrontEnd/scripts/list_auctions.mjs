import { Connection, PublicKey } from '@solana/web3.js';
import { BorshAccountsCoder } from '@coral-xyz/anchor';
import fs from 'fs';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const PROGRAM_ID = new PublicKey('Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq');
const idl = JSON.parse(fs.readFileSync('d:/189/FrontEnd/src/idl/mintly_marketplace.json', 'utf8'));

async function main() {
  const accounts = await conn.getProgramAccounts(PROGRAM_ID);
  console.log('Total accounts for program:', accounts.length);
  const coder = new BorshAccountsCoder(idl);
  for (const acc of accounts) {
    console.log('Account:', acc.pubkey.toBase58(), 'Data len:', acc.account.data.length);
    for (const accDef of idl.accounts) {
      try {
        const decoded = coder.decode(accDef.name, acc.account.data);
        console.log(`  Decoded as ${accDef.name}:`, JSON.stringify(decoded));
      } catch (e) {}
    }
  }
}

main().catch(console.error);
