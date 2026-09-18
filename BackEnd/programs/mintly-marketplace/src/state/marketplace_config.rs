use anchor_lang::prelude::*;

#[account]
pub struct MarketplaceConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub forfeiture_recipient: Pubkey,
    pub fee_bps: u16,
    pub deposit_bps: u16,
    pub paused: bool,
    pub bump: u8,
}

impl MarketplaceConfig {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 2 + 1 + 1;
}
