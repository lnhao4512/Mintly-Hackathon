use anchor_lang::prelude::*;

#[account]
pub struct TokenConfig {
    pub mint: Pubkey,
    pub decimals: u8,
    pub enabled: bool,
    pub bump: u8,
}

impl TokenConfig {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 1;
}
