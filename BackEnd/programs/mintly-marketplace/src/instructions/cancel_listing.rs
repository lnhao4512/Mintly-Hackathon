use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Listing, ListingStatus};
use crate::constants::ESCROW_SEED;
use crate::errors::MarketplaceError;
use crate::events::ListingCancelled;

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        constraint = listing.status == ListingStatus::ACTIVE @ MarketplaceError::InvalidListingState,
        has_one = seller @ MarketplaceError::UnauthorizedSeller,
    )]
    pub listing: Box<Account<'info, Listing>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, listing.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = listing.nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = listing.nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    let listing = &mut ctx.accounts.listing;

    // Return NFT to seller
    let listing_key = listing.key();
    let escrow_bump = ctx.bumps.escrow_authority;
    let seeds = &[
        ESCROW_SEED,
        listing_key.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.seller_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(
        cpi_program,
        cpi_accounts,
        signer,
    );
    token::transfer(cpi_ctx, 1)?;

    listing.status = ListingStatus::CANCELLED;

    emit!(ListingCancelled {
        listing: listing.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
