# 🎨 MINTLY - Anti-Default 1/1 NFT Auction Platform on Solana

> **Next-Gen Decentralized 1/1 NFT Marketplace featuring AI Copyright Verification and Cryptographic 10% Escrow Bidding against Winner Defaulting and Sniping.**

Built for Solana Hackathon 2026.

---

## 🌟 Key Features

1. **🔒 Smart Contract Escrow PDA (10% Deposit)**:
   - Requires a 10% refundable escrow deposit on every bid placed.
   - Automatically and instantly refunds 100% of outbid users' deposits on-chain.
   - When the auction ends, the winner pays the remaining 90% to receive the NFT.
   - If the winner defaults, the 10% deposit penalty is forfeited and transferred to the Seller.

2. **🛡️ Commit-Reveal Sealed-Bid Cryptography (SHA-256)**:
   - Anonymously secures bid commitments to protect bidders from front-running and MEV bot sniping at the final seconds.

3. **🧠 AI Image Similarity & Provenance Verification**:
   - Perceptual hash and vector similarity check before minting to prevent duplicate / plagiarized artwork uploads.

4. **📜 NFT Passport & Multi-Round Secondary Resale**:
   - Full on-chain lifecycle and provenance chain tracking across multiple owners and auction rounds.

---

## 🏗️ Repository Architecture

- **`BackEnd/`**: Solana Anchor Smart Contract program written in Rust (`mintly-marketplace`).
  - `programs/mintly-marketplace/src/instructions/`:
    - `create_auction.rs`: Locks 1/1 SPL NFT into Escrow PDA and initializes auction state.
    - `place_bid.rs` / `commit_bid.rs` / `reveal_bid.rs`: Escrow deposit, commit-reveal hashing, outbid auto-refunds.
    - `pay_balance.rs`: 90% remaining balance payment, platform fee split, and CPI NFT ownership transfer to winner.
    - `default_winner.rs`: Anti-default penalty claiming.
    - `buy_listing.rs` / `create_listing.rs`: Direct listing marketplace mechanics.
  - `target/idl/mintly_marketplace.json`: Generated Anchor IDL.

- **`FrontEnd/`**: Modern Web3 application built with Next.js 16 (App Router), TypeScript, Tailwind CSS, and Solana Wallet Adapter.

---

## 🚀 Getting Started

### FrontEnd Setup
```bash
cd FrontEnd
npm install
npm run dev
```

