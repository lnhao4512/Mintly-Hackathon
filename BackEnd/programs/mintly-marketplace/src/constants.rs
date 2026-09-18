use anchor_lang::prelude::*;

#[constant]
pub const DEFAULT_DEPOSIT_BPS: u16 = 1000;

#[constant]
pub const BPS_DENOMINATOR: u64 = 10000;

// Seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const TOKEN_SEED: &[u8] = b"token";
pub const AUCTION_SEED: &[u8] = b"auction";
pub const ESCROW_SEED: &[u8] = b"escrow";
pub const BID_SEED: &[u8] = b"bid";
pub const BID_COMMITMENT_SEED: &[u8] = b"bid-commitment";
pub const LISTING_SEED: &[u8] = b"listing";
