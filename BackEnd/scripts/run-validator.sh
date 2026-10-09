#!/usr/bin/env bash
set -e

export PATH="/root/.local/share/solana/install/active_release/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

mkdir -p /root/solana-ledger

exec solana-test-validator \
  --bind-address 0.0.0.0 \
  --rpc-port 8899 \
  --ledger /root/solana-ledger \
  --bpf-program 6HYc93V8Xzf6BYw8mTUgXZzpbJWrwuFQbw4BxRKYUgSA /mnt/d/189/BackEnd/target/deploy/mintly_marketplace.so \
  --reset
