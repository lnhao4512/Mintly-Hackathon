#!/usr/bin/env bash
set -e

export PATH="/root/.cargo/bin:/home/nhathaomt123456/.cargo/bin:$PATH"
echo "=== Step 1: Configuring Rust ==="
rustup default stable
rustc --version
cargo --version

echo "=== Rust is ready ==="
