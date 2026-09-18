#!/usr/bin/env bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
cd /mnt/d/189/BackEnd

echo "=== Starting Solana Test Validator (Localnet) ==="
pkill solana-test-val || true
nohup solana-test-validator --reset --quiet > /tmp/validator.log 2>&1 &
sleep 5

solana config set --url http://127.0.0.1:8899

echo "=== Airdropping 100 SOL to deployer ==="
solana airdrop 100
solana balance

PROGRAM_ID=$(solana-keygen pubkey target/deploy/mintly_marketplace-keypair.json)
echo "=== Deploying to Localnet (Program ID: $PROGRAM_ID) ==="
solana program deploy target/deploy/mintly_marketplace.so --program-id target/deploy/mintly_marketplace-keypair.json

echo "=== Program deployed successfully! ==="
solana program show $PROGRAM_ID
