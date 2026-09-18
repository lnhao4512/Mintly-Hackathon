#!/usr/bin/env bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:/root/.cargo/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

echo "=== Installing Rust 1.79.0 ==="
rustup install 1.79.0
rustup default 1.79.0

rustc --version
cargo --version

echo "=== Removing old lockfile and generating new lockfile ==="
cd /mnt/d/189/BackEnd
rm -f Cargo.lock
cargo generate-lockfile
head -n 5 Cargo.lock

echo "=== Running anchor build ==="
anchor build
echo "=== Anchor build succeeded! ==="
