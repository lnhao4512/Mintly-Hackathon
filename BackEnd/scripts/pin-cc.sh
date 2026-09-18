#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning cc to 1.0.98 and jobserver to 0.1.32 ==="
cargo update -p cc --precise 1.0.98 || true
cargo update -p jobserver --precise 0.1.32 || true

echo "=== Running anchor build ==="
anchor build
echo "=== SUCCESS! ==="
