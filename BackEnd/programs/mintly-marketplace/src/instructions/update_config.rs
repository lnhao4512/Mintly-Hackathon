use anchor_lang::prelude::*;
use crate::state::MarketplaceConfig;
use crate::constants::CONFIG_SEED;
use crate::errors::MarketplaceError;
use crate::events::MarketplaceConfigUpdated;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MarketplaceError::Unauthorized
    )]
    pub config: Account<'info, MarketplaceConfig>,
}

pub fn handler(
    ctx: Context<UpdateConfig>,
    new_treasury: Option<Pubkey>,
    new_forfeiture_recipient: Option<Pubkey>,
    new_fee_bps: Option<u16>,
    new_deposit_bps: Option<u16>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(treasury) = new_treasury {
        config.treasury = treasury;
    }
    if let Some(forfeiture_recipient) = new_forfeiture_recipient {
        config.forfeiture_recipient = forfeiture_recipient;
    }
    if let Some(fee_bps) = new_fee_bps {
        config.fee_bps = fee_bps;
    }
    if let Some(deposit_bps) = new_deposit_bps {
        config.deposit_bps = deposit_bps;
    }

    emit!(MarketplaceConfigUpdated {
        authority: config.authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
