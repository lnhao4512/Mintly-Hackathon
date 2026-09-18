use anchor_lang::prelude::*;
use crate::state::{MarketplaceConfig, TokenConfig};
use crate::constants::{CONFIG_SEED, TOKEN_SEED};
use crate::errors::MarketplaceError;

#[derive(Accounts)]
#[instruction(payment_mint: Pubkey)]
pub struct AddToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MarketplaceError::Unauthorized
    )]
    pub config: Account<'info, MarketplaceConfig>,

    #[account(
        init_if_needed,
        payer = authority,
        space = TokenConfig::LEN,
        seeds = [TOKEN_SEED, config.key().as_ref(), payment_mint.as_ref()],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    pub system_program: Program<'info, System>,
}

pub fn add_token_handler(ctx: Context<AddToken>, payment_mint: Pubkey, decimals: u8) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    token_config.mint = payment_mint;
    token_config.decimals = decimals;
    token_config.enabled = true;
    token_config.bump = ctx.bumps.token_config;
    Ok(())
}

#[derive(Accounts)]
pub struct RemoveToken<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = authority @ MarketplaceError::Unauthorized
    )]
    pub config: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        seeds = [TOKEN_SEED, config.key().as_ref(), token_config.mint.as_ref()],
        bump = token_config.bump,
    )]
    pub token_config: Account<'info, TokenConfig>,
}

pub fn remove_token_handler(ctx: Context<RemoveToken>) -> Result<()> {
    let token_config = &mut ctx.accounts.token_config;
    token_config.enabled = false;
    Ok(())
}
