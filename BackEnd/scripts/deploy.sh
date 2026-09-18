#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Step 1: Configuring Solana Devnet ==="
mkdir -p ~/.config/solana
if [ ! -f ~/.config/solana/id.json ]; then
    echo "Creating deployer wallet..."
    solana-keygen new --no-bip39-passphrase -s --force -o ~/.config/solana/id.json
fi

solana config set --url https://api.devnet.solana.com
DEPLOYER_PUBKEY=$(solana-keygen pubkey ~/.config/solana/id.json)
echo "Deployer wallet: $DEPLOYER_PUBKEY"

echo "=== Step 2: Checking Balance and Airdropping SOL ==="
BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE SOL"
if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
    echo "Requesting airdrop of 2 SOL..."
    solana airdrop 2 || solana airdrop 1 || true
    solana balance
fi

echo "=== Step 3: Getting Program ID from Keypair ==="
if [ ! -f target/deploy/mintly_marketplace-keypair.json ]; then
    echo "Generating program keypair..."
    mkdir -p target/deploy
    solana-keygen new --no-bip39-passphrase -s --force -o target/deploy/mintly_marketplace-keypair.json
fi

PROGRAM_ID=$(solana-keygen pubkey target/deploy/mintly_marketplace-keypair.json)
echo "Program ID: $PROGRAM_ID"

echo "=== Step 4: Syncing Program ID in lib.rs and Anchor.toml ==="
sed -i "s/declare_id!(\"[^\"]*\")/declare_id!(\"$PROGRAM_ID\")/g" programs/mintly-marketplace/src/lib.rs
sed -i "s/mintly_marketplace = \"[^\"]*\"/mintly_marketplace = \"$PROGRAM_ID\"/g" Anchor.toml

echo "=== Step 5: Final Incremental Anchor Build ==="
anchor build --no-idl


echo "=== Step 6: Deploying Program to Devnet ==="
solana program deploy target/deploy/mintly_marketplace.so --program-id target/deploy/mintly_marketplace-keypair.json

echo "=== Step 7: Syncing IDL to FrontEnd ==="
cp target/idl/mintly_marketplace.json /mnt/d/189/FrontEnd/src/idl/mintly_marketplace.json
echo "IDL synced to FrontEnd/src/idl/mintly_marketplace.json"

echo "=== DEPLOYMENT COMPLETED SUCCESSFULLY! ==="
echo "PROGRAM_ID=$PROGRAM_ID"
