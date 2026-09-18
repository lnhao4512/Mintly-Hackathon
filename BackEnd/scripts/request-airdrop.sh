#!/usr/bin/env bash

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

WALLET="2ArwEtwQa2KvJqvmPYbMbN4qe6bdKqSfzYb5G7svikAn"
echo "Target wallet: $WALLET"

echo "Attempting airdrop via solana cli..."
for i in {1..5}; do
    echo "Attempt $i: solana airdrop 1..."
    solana airdrop 1 $WALLET --url https://api.devnet.solana.com && break || sleep 2
    solana airdrop 0.5 $WALLET --url https://api.devnet.solana.com && break || sleep 2
done

solana balance $WALLET --url https://api.devnet.solana.com
