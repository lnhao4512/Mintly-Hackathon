use anchor_lang::prelude::*;

#[constant]
pub const DEFAULT_DEPOSIT_BPS: u16 = 1000;

#[constant]
pub const BPS_DENOMINATOR: u64 = 10000;

/// Share of a forfeited deposit paid to the seller as no-show compensation (70%); the rest goes to the platform.
#[constant]
pub const SELLER_FORFEIT_BPS: u64 = 7000;

/// Anti-sniping: a bid placed in the last ANTI_SNIPE_WINDOW seconds pushes end_time to now + ANTI_SNIPE_EXTENSION.
pub const ANTI_SNIPE_WINDOW: i64 = 60;
pub const ANTI_SNIPE_EXTENSION: i64 = 60;

// Seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const TOKEN_SEED: &[u8] = b"token";
pub const AUCTION_SEED: &[u8] = b"auction";
pub const ESCROW_SEED: &[u8] = b"escrow";
/// Seed of the per-auction PDA token account that holds bidders' payment (deposit + balance).
pub const ESCROW_PAY_SEED: &[u8] = b"escrow-pay";
pub const BID_SEED: &[u8] = b"bid";
pub const BID_COMMITMENT_SEED: &[u8] = b"bid-commitment";
pub const LISTING_SEED: &[u8] = b"listing";
