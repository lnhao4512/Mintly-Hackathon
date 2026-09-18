use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum AuctionStatus {
    DRAFT,
    LIVE,
    REVEAL_OPEN,
    REVEAL_CLOSED,
    ENDED,
    DEPOSIT_PENDING,
    PAYMENT_PENDING,
    SETTLED,
    DEFAULTED,
    NO_BID,
    CANCELLED,
}

#[account]
pub struct Auction {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub start_price: u64,
    pub min_increment: u64,
    pub current_bid: u64,
    pub highest_bidder: Option<Pubkey>,
    pub start_time: i64,
    pub end_time: i64,
    pub reveal_deadline: i64,
    pub deposit_deadline: i64,
    pub payment_deadline: i64,
    pub deposit_paid: u64,
    pub balance_paid: u64,
    pub status: AuctionStatus,
    pub bump: u8,
    pub created_at: i64,
}

impl Auction {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + (1 + 32) + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8;
}
