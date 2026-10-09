import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MARKETPLACE_PROGRAM_ID || "6HYc93V8Xzf6BYw8mTUgXZzpbJWrwuFQbw4BxRKYUgSA"
);

export const WSOL_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_PAYMENT_MINT || "So11111111111111111111111111111111111111112"
);

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const NETWORK =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK || (RPC_ENDPOINT.includes("devnet") ? "devnet" : "localnet");

// Initial fee when the marketplace is first created (2.5%); the UI always shows the on-chain value.
export const MARKETPLACE_FEE_BPS = 250;

export const SEEDS = {
  CONFIG: Buffer.from("config"),
  TOKEN: Buffer.from("token"),
  LISTING: Buffer.from("listing"),
  AUCTION: Buffer.from("auction"),
  ESCROW: Buffer.from("escrow"),
  ESCROW_PAY: Buffer.from("escrow-pay"),
  BID: Buffer.from("bid"),
};

/** PDA token account holding the bidders' payment for an auction (place_bid.rs, program version with ESCROW_PAY_SEED). */
export function getAuctionEscrowPaymentPda(auctionPda: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.ESCROW_PAY, auctionPda.toBuffer()], programId);
}

export function getConfigPda(programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEEDS.CONFIG], programId);
}

export function getTokenConfigPda(
  configPda: PublicKey,
  paymentMint: PublicKey = WSOL_MINT,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.TOKEN, configPda.toBuffer(), paymentMint.toBuffer()],
    programId
  );
}

export function getListingPda(
  nftMint: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.LISTING, nftMint.toBuffer()],
    programId
  );
}

export function getAuctionPda(
  nftMint: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.AUCTION, nftMint.toBuffer()],
    programId
  );
}

export function getListingEscrowAuthorityPda(
  listingPda: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ESCROW, listingPda.toBuffer()],
    programId
  );
}

export function getAuctionEscrowAuthorityPda(
  auctionPda: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.ESCROW, auctionPda.toBuffer()],
    programId
  );
}

export function getBidPda(
  auctionPda: PublicKey,
  bidder: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.BID, auctionPda.toBuffer(), bidder.toBuffer()],
    programId
  );
}

/**
 * Wallets used by `scripts/devnet_sim.mjs` to generate simulated auctions. Their on-chain accounts cannot be
 * deleted (the program has no close instruction), so they are excluded from every listing and statistic.
 */
export const SIMULATED_SELLERS = new Set<string>(["77jAqjDrkeo6YPgzGXtuRQJEjRh7fGJRqk3KghR4uAyE"]);
