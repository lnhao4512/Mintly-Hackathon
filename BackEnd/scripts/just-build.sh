#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"
cd /mnt/d/189/BackEnd

cargo update -p unicode-segmentation --precise 1.12.0

echo "=== Running anchor build --no-idl ==="
anchor build --no-idl
echo "=== ANCHOR BUILD SUCCEEDED! ==="
