#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning indexmap to 2.6.0 ==="
cargo update -p indexmap --precise 2.6.0 || true

echo "=== Checking syn in Cargo.lock ==="
cargo update -p syn:3.0.6 --precise 2.0.98 2>/dev/null || true

echo "=== Running anchor build ==="
anchor build
echo "=== SUCCESS! ==="
