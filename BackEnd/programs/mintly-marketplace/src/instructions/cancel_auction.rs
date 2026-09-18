use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus};
use crate::constants::ESCROW_SEED;
use crate::errors::MarketplaceError;
use crate::events::AuctionCancelled;

#[derive(Accounts)]
pub struct CancelAuction<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        has_one = seller @ MarketplaceError::UnauthorizedSeller,
    )]
    pub auction: Box<Account<'info, Auction>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, auction.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = auction.nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = auction.nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelAuction>) -> Result<()> {
    let auction = &mut ctx.accounts.auction;
    
    // MVP policy: Seller may cancel DRAFT. Seller may cancel LIVE only if no bids.
    if auction.status == AuctionStatus::LIVE {
        require!(auction.highest_bidder.is_none(), MarketplaceError::InvalidAuctionState);
    } else {
        require!(auction.status == AuctionStatus::DRAFT || auction.status == AuctionStatus::NO_BID, MarketplaceError::InvalidAuctionState);
    }

    // Return NFT to seller
    let auction_key = auction.key();
    let escrow_bump = ctx.bumps.escrow_authority;
    let seeds = &[
        ESCROW_SEED,
        auction_key.as_ref(),
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

    auction.status = AuctionStatus::CANCELLED;

    emit!(AuctionCancelled {
        auction: auction.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
