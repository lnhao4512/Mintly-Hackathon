use anchor_lang::prelude::*;

#[account]
pub struct BidCommitment {
    pub auction: Pubkey,
    pub bidder: Pubkey,
    pub commitment: [u8; 32],
    pub revealed_amount: u64,
    pub revealed: bool,
    pub bump: u8,
}

impl BidCommitment {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 1 + 1;
}
