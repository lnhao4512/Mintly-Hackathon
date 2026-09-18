#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning blake3 to 1.5.5 ==="
cargo update -p blake3 --precise 1.5.5

echo "=== Checking Cargo.lock for crypto-common 0.2.2 ==="
grep -n "crypto-common" Cargo.lock || true

echo "=== Running anchor build ==="
anchor build
