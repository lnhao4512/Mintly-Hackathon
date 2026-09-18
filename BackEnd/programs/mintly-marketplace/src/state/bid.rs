use anchor_lang::prelude::*;

#[account]
pub struct Bid {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub bump: u8,
}

impl Bid {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}
