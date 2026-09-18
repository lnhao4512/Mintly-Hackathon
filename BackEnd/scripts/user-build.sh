#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

echo "=== Switching Rust default to 1.79.0 ==="
rustup default 1.79.0
rustc --version
cargo --version
solana --version
anchor --version

echo "=== Regenerating Cargo.lock with Rust 1.79.0 ==="
cd /mnt/d/189/BackEnd
rm -f Cargo.lock
cargo generate-lockfile
head -n 5 Cargo.lock

echo "=== Running anchor build ==="
anchor build
echo "=== ANCHOR BUILD SUCCESSFUL! ==="
