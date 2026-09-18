#!/usr/bin/env bash
set -e

export RUSTUP_HOME=/home/nhathaomt123456/.rustup
export CARGO_HOME=/home/nhathaomt123456/.cargo
export PATH="/root/.local/share/solana/install/active_release/bin:/home/nhathaomt123456/.cargo/bin:$PATH"

cd /mnt/d/189/BackEnd

echo "=== Pinning toml_edit to 0.22.24 ==="
cargo update -p toml_edit --precise 0.22.24 || cargo update -p proc-macro-crate:3.5.0 --precise 3.1.0

echo "=== Running anchor build ==="
anchor build
