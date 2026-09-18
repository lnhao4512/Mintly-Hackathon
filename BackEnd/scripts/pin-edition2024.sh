#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning zeroize_derive to 1.4.2 ==="
cargo update -p zeroize_derive --precise 1.4.2 || true

echo "=== Checking for any other 3.x syn or edition2024 crates in lockfile ==="
grep -E 'name = "syn"|version = "3\.' Cargo.lock || true

echo "=== Pinning syn if needed ==="
cargo update -p syn:3.0.6 --precise 2.0.98 2>/dev/null || true

echo "=== Running anchor build ==="
anchor build
echo "=== ANCHOR BUILD COMPLETED SUCCESSFULLY! ==="
