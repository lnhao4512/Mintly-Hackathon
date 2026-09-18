#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning borsh to 1.5.1 ==="
cargo update -p borsh:1.8.1 --precise 1.5.1 || cargo update -p borsh --precise 1.5.1
cargo update -p borsh-derive:1.8.1 --precise 1.5.1 || cargo update -p borsh-derive --precise 1.5.1

echo "=== Running anchor build ==="
anchor build
echo "=== ANCHOR BUILD SUCCEEDED! ==="
