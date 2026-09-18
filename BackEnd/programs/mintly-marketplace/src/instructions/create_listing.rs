use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Listing, ListingStatus, MarketplaceConfig, TokenConfig};
use crate::constants::{CONFIG_SEED, LISTING_SEED, ESCROW_SEED, TOKEN_SEED};
use crate::errors::MarketplaceError;
use crate::events::ListingCreated;

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MarketplaceError::MarketplacePaused
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        seeds = [TOKEN_SEED, config.key().as_ref(), payment_mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.enabled @ MarketplaceError::InvalidPaymentToken
    )]
    pub token_config: Box<Account<'info, TokenConfig>>,

    // FE mints the NFT externally with Metaplex; Anchor receives the existing mint and
    // transfers it into a program-owned escrow token account for listing management.
    pub nft_mint: Box<Account<'info, Mint>>,
    pub payment_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [LISTING_SEED, nft_mint.key().as_ref()],
        bump
    )]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, listing.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = seller,
        token::mint = nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    price: u64,
    expiry: i64,
) -> Result<()> {
    require!(price > 0, MarketplaceError::InvalidStartPrice);
    require!(expiry > Clock::get()?.unix_timestamp, MarketplaceError::InvalidDeadline);

    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.nft_mint = ctx.accounts.nft_mint.key();
    listing.payment_mint = ctx.accounts.payment_mint.key();
    listing.price = price;
    listing.expiry = expiry;
    listing.status = ListingStatus::ACTIVE;
    listing.bump = ctx.bumps.listing;
    listing.created_at = Clock::get()?.unix_timestamp;

    // Lock NFT into escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.seller_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, 1)?;

    emit!(ListingCreated {
        listing: listing.key(),
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        price,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
