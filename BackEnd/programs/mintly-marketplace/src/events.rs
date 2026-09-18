use anchor_lang::prelude::*;
use crate::state::auction::AuctionStatus;
use crate::state::listing::ListingStatus;

#[event]
pub struct MarketplaceInitialized {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct MarketplaceConfigUpdated {
    pub authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct MarketplacePaused {
    pub timestamp: i64,
}

#[event]
pub struct MarketplaceUnpaused {
    pub timestamp: i64,
}

#[event]
pub struct AuctionCreated {
    pub auction: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub start_price: u64,
    pub timestamp: i64,
}

#[event]
pub struct BidPlaced {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PreviousBidderRefunded {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuctionFinalized {
    pub auction: Pubkey,
    pub status: AuctionStatus,
    pub timestamp: i64,
}

#[event]
pub struct DepositPaid {
    pub auction: Pubkey,
    pub winner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BalancePaid {
    pub auction: Pubkey,
    pub winner: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuctionSettled {
    pub auction: Pubkey,
    pub winner: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AuctionDefaulted {
    pub auction: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AuctionCancelled {
    pub auction: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ListingCreated {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct ListingPurchased {
    pub listing: Pubkey,
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub timestamp: i64,
}

#[event]
pub struct ListingCancelled {
    pub listing: Pubkey,
    pub timestamp: i64,
}
