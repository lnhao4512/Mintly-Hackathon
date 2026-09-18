import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://api.devnet.solana.com', 'confirmed');
const seller = new PublicKey('7pPRRJWaSEwTMNywRDwgRY9ZrVngQFZ3Dp6Fir2pWPxX');

async function main() {
  const balance = await conn.getBalance(seller);
  console.log('=== SELLER ON-CHAIN BALANCE ===');
  console.log('Address:', seller.toBase58());
  console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL');

  console.log('\n=== RECENT TRANSACTIONS (Top 10) ===');
  const signatures = await conn.getSignaturesForAddress(seller, { limit: 10 });
  for (const sig of signatures) {
    console.log('---');
    console.log('Signature:', sig.signature);
    console.log('Slot:', sig.slot);
    console.log('BlockTime:', sig.blockTime ? new Date(sig.blockTime * 1000).toLocaleString('vi-VN') : 'Unknown');
    console.log('Err:', sig.err ? JSON.stringify(sig.err) : 'Success (None)');
    console.log('Memo:', sig.memo || 'None');

    try {
      const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
      if (tx && tx.meta) {
        const accountIndex = tx.transaction.message.accountKeys.findIndex(k => (k.pubkey || k).toBase58() === seller.toBase58());
        if (accountIndex >= 0) {
          const pre = tx.meta.preBalances[accountIndex];
          const post = tx.meta.postBalances[accountIndex];
          const diff = (post - pre) / 1e9;
          console.log(`Balance change for seller: ${diff >= 0 ? '+' : ''}${diff.toFixed(4)} SOL (Pre: ${(pre / 1e9).toFixed(4)} -> Post: ${(post / 1e9).toFixed(4)})`);
        }
      }
    } catch (e) {
      console.log('Could not fetch parsed tx:', e.message);
    }
  }
}

main().catch(console.error);
