#!/usr/bin/env bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

echo "Checking environment:"
rustc --version
cargo --version
solana --version
anchor --version

cd /mnt/d/189/BackEnd
echo "Running anchor build..."
anchor build
echo "Build succeeded!"
