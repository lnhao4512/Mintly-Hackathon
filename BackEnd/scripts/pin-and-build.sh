#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Checking who pulls crypto-common 0.2.2 ==="
cargo tree -i crypto-common:0.2.2 || true

echo "=== Pinning crypto-common:0.2.2 to 0.1.6 ==="
cargo update -p crypto-common:0.2.2 --precise 0.1.6 || true

echo "=== Running anchor build ==="
anchor build
