# Mintly Solana Marketplace (BackEnd)

A comprehensive Web3 NFT Creator & Marketplace smart contract built on Solana using Anchor.

## Architecture

The program relies on deterministic PDA architectures to govern auctions, bids, and escrows securely.

### State PDA Architecture
- **MarketplaceConfig**: `["config"]`
- **Auction**: `["auction", nft_mint]`
- **Bid**: `["bid", auction, bidder]`
- **Escrow**: `["escrow", auction]`
- **Listing**: `["listing", nft_mint]`
- **TokenConfig**: `["token", config, payment_mint]`

## Requirements

- **Rust Version**: 1.70.0+
- **Solana CLI**: 1.16.x+
- **Anchor**: 0.30.1

## Installation & Setup

1. **Install Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Install Solana CLI**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.17.0/install)"
   ```
   *Reference: [Solana Docs](https://solana.com/docs/intro/installation)*

3. **Install Anchor**:
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

4. **Wallet Configuration**:
   ```bash
   solana-keygen new -o ~/.config/solana/id.json
   ```

5. **Devnet Configuration**:
   ```bash
   solana config set --url devnet
   ```

6. **Airdrop SOL**:
   ```bash
   solana airdrop 2
   ```

## Build & Test

1. **Build Program**:
   ```bash
   anchor build
   ```

2. **Run Tests**:
   ```bash
   anchor test
   ```

## Deploy

To deploy to devnet:
```bash
anchor deploy
```

## Security Model

The program uses:
- Proper constraints for accounts (signer, mutually authenticated keys).
- Whitelists for payment tokens to prevent fake SPL mints.
- `checked_add`, `checked_sub`, `checked_mul`, `checked_div` to prevent arithmetic overflow/underflow.
- Comprehensive checks for deadlines and state transitions.
