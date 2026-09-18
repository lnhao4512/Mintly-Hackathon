#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning getrandom:0.4.3 to 0.2.15 ==="
cargo update -p getrandom:0.4.3 --precise 0.2.15 || true

echo "=== Running anchor build ==="
anchor build
echo "=== SUCCESS! ==="
