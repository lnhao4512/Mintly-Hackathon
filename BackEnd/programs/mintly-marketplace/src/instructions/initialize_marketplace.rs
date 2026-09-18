use anchor_lang::prelude::*;
use crate::state::MarketplaceConfig;
use crate::constants::{CONFIG_SEED, DEFAULT_DEPOSIT_BPS};
use crate::events::MarketplaceInitialized;

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = MarketplaceConfig::LEN,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, MarketplaceConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeMarketplace>,
    treasury: Pubkey,
    forfeiture_recipient: Pubkey,
    fee_bps: u16,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.treasury = treasury;
    config.forfeiture_recipient = forfeiture_recipient;
    config.fee_bps = fee_bps;
    config.deposit_bps = DEFAULT_DEPOSIT_BPS;
    config.paused = false;
    config.bump = ctx.bumps.config;

    emit!(MarketplaceInitialized {
        authority: config.authority,
        treasury: config.treasury,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
