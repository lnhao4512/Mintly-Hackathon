use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Listing, ListingStatus, MarketplaceConfig};
use crate::constants::{CONFIG_SEED, ESCROW_SEED};
use crate::errors::MarketplaceError;
use crate::events::ListingPurchased;
use crate::utils::calculate_fee;

#[derive(Accounts)]
pub struct BuyListing<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MarketplaceError::MarketplacePaused
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        mut,
        constraint = listing.status == ListingStatus::ACTIVE @ MarketplaceError::InvalidListingState,
        constraint = listing.payment_mint == payment_mint.key() @ MarketplaceError::InvalidPaymentToken,
        constraint = listing.nft_mint == nft_mint.key() @ MarketplaceError::InvalidNFTMint,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_payment_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, listing.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_nft_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: treasury
    #[account(
        mut,
        constraint = *treasury_payment_account.owner == config.treasury @ MarketplaceError::InvalidTreasury,
    )]
    pub treasury_payment_account: AccountInfo<'info>, // Token account for treasury

    /// CHECK: seller
    #[account(
        mut,
        constraint = *seller_payment_account.owner == listing.seller @ MarketplaceError::UnauthorizedSeller,
    )]
    pub seller_payment_account: AccountInfo<'info>, // Token account for seller

    pub payment_mint: Box<Account<'info, Mint>>,
    pub nft_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BuyListing>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let listing = &mut ctx.accounts.listing;
    
    require!(current_time <= listing.expiry, MarketplaceError::InvalidDeadline);

    let price = listing.price;
    let fee = calculate_fee(price, ctx.accounts.config.fee_bps)?;
    let seller_proceeds = price.checked_sub(fee).ok_or(MarketplaceError::Underflow)?;

    let cpi_program = ctx.accounts.token_program.to_account_info();

    // 1. Transfer Payment from Buyer to Treasury (Fee)
    if fee > 0 {
        let fee_cpi_accounts = Transfer {
            from: ctx.accounts.buyer_payment_account.to_account_info(),
            to: ctx.accounts.treasury_payment_account.clone(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let fee_cpi_ctx = CpiContext::new(cpi_program.clone(), fee_cpi_accounts);
        token::transfer(fee_cpi_ctx, fee)?;
    }

    // 2. Transfer Payment from Buyer to Seller
    if seller_proceeds > 0 {
        let seller_cpi_accounts = Transfer {
            from: ctx.accounts.buyer_payment_account.to_account_info(),
            to: ctx.accounts.seller_payment_account.clone(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let seller_cpi_ctx = CpiContext::new(cpi_program.clone(), seller_cpi_accounts);
        token::transfer(seller_cpi_ctx, seller_proceeds)?;
    }

    // 3. Transfer NFT from Escrow to Buyer
    let listing_key = listing.key();
    let escrow_bump = ctx.bumps.escrow_authority;
    let seeds = &[
        ESCROW_SEED,
        listing_key.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    let nft_cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.buyer_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let nft_cpi_ctx = CpiContext::new_with_signer(
        cpi_program.clone(),
        nft_cpi_accounts,
        signer,
    );
    token::transfer(nft_cpi_ctx, 1)?;

    listing.status = ListingStatus::SOLD;

    emit!(ListingPurchased {
        listing: listing.key(),
        buyer: ctx.accounts.buyer.key(),
        seller: listing.seller,
        nft_mint: listing.nft_mint,
        price,
        timestamp: current_time,
    });

    Ok(())
}
