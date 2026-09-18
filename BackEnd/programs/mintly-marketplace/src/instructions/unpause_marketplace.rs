use anchor_lang::prelude::*;
use crate::state::MarketplaceConfig;
use crate::constants::CONFIG_SEED;
use crate::errors::MarketplaceError;
use crate::events::MarketplaceUnpaused;

#[derive(Accounts)]
pub struct UnpauseMarketplace<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MarketplaceError::Unauthorized
    )]
    pub config: Account<'info, MarketplaceConfig>,
}

pub fn handler(ctx: Context<UnpauseMarketplace>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.paused = false;

    emit!(MarketplaceUnpaused {
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
