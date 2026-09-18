#!/usr/bin/env bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

mkdir -p /root/solana-ledger

exec solana-test-validator \
  --bind-address 0.0.0.0 \
  --rpc-port 8899 \
  --ledger /root/solana-ledger \
  --bpf-program Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq /mnt/d/189/BackEnd/target/deploy/mintly_marketplace.so \
  --reset
