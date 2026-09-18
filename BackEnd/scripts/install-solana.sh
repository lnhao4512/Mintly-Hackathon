#!/usr/bin/env bash
set -e

echo "=== Step 2: Installing Solana CLI v1.18.26 ==="
sh -c "$(curl -sSfL https://release.anza.xyz/v1.18.26/install)"

export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
solana --version

echo "=== Solana CLI installed ==="
