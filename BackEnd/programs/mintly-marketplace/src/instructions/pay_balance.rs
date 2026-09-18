use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus, MarketplaceConfig};
use crate::constants::{CONFIG_SEED, ESCROW_SEED};
use crate::errors::MarketplaceError;
use crate::events::AuctionSettled;
use crate::utils::calculate_fee;

#[derive(Accounts)]
pub struct PayBalance<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        mut,
        constraint = (auction.status == AuctionStatus::LIVE || auction.status == AuctionStatus::PAYMENT_PENDING || auction.status == AuctionStatus::REVEAL_OPEN || auction.status == AuctionStatus::ENDED || auction.status == AuctionStatus::DEPOSIT_PENDING) @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Box<Account<'info, Auction>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = winner,
    )]
    pub winner_payment_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, auction.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = winner,
    )]
    pub winner_nft_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = config.treasury,
    )]
    pub treasury_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = payment_mint,
        token::authority = auction.seller,
    )]
    pub seller_payment_account: Box<Account<'info, TokenAccount>>,

    pub payment_mint: Box<Account<'info, Mint>>,
    pub nft_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<PayBalance>, amount: u64) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    
    require!(current_time <= auction.payment_deadline, MarketplaceError::PaymentDeadlinePassed);
    require!(ctx.accounts.payment_mint.key() == auction.payment_mint, MarketplaceError::InvalidPaymentToken);
    require!(ctx.accounts.nft_mint.key() == auction.nft_mint, MarketplaceError::InvalidNFTMint);

    let total_amount = if amount > 0 {
        amount
    } else if auction.current_bid > 0 {
        auction.current_bid
    } else {
        auction.start_price
    };

    require!(total_amount >= auction.start_price, MarketplaceError::BidTooLow);

    let remaining_to_pay = total_amount.saturating_sub(auction.deposit_paid);

    // 1. Transfer remaining 90% (or total if no deposit) from winner to escrow
    if remaining_to_pay > 0 {
        let cpi_accounts = Transfer {
            from: ctx.accounts.winner_payment_account.to_account_info(),
            to: ctx.accounts.escrow_payment_account.to_account_info(),
            authority: ctx.accounts.winner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program.clone(), cpi_accounts);
        token::transfer(cpi_ctx, remaining_to_pay)?;
    }

    auction.current_bid = total_amount;
    auction.highest_bidder = Some(ctx.accounts.winner.key());
    auction.balance_paid = remaining_to_pay;

    // 2. Settle the funds (100% funds are in escrow)
    let fee = calculate_fee(total_amount, ctx.accounts.config.fee_bps)?;
    let seller_proceeds = total_amount.checked_sub(fee).ok_or(MarketplaceError::Underflow)?;

    let auction_key = auction.key();
    let escrow_bump = ctx.bumps.escrow_authority;
    let seeds = &[
        ESCROW_SEED,
        auction_key.as_ref(),
        &[escrow_bump],
    ];
    let signer = &[&seeds[..]];

    // Pay Fee
    if fee > 0 {
        let fee_cpi_accounts = Transfer {
            from: ctx.accounts.escrow_payment_account.to_account_info(),
            to: ctx.accounts.treasury_payment_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let fee_cpi_ctx = CpiContext::new_with_signer(
            cpi_program.clone(),
            fee_cpi_accounts,
            signer,
        );
        token::transfer(fee_cpi_ctx, fee)?;
    }

    // Pay Seller
    if seller_proceeds > 0 {
        let seller_cpi_accounts = Transfer {
            from: ctx.accounts.escrow_payment_account.to_account_info(),
            to: ctx.accounts.seller_payment_account.to_account_info(),
            authority: ctx.accounts.escrow_authority.to_account_info(),
        };
        let seller_cpi_ctx = CpiContext::new_with_signer(
            cpi_program.clone(),
            seller_cpi_accounts,
            signer,
        );
        token::transfer(seller_cpi_ctx, seller_proceeds)?;
    }

    // 3. Transfer NFT to winner
    let nft_cpi_accounts = Transfer {
        from: ctx.accounts.escrow_nft_account.to_account_info(),
        to: ctx.accounts.winner_nft_account.to_account_info(),
        authority: ctx.accounts.escrow_authority.to_account_info(),
    };
    let nft_cpi_ctx = CpiContext::new_with_signer(
        cpi_program.clone(),
        nft_cpi_accounts,
        signer,
    );
    token::transfer(nft_cpi_ctx, 1)?;

    auction.status = AuctionStatus::SETTLED;

    emit!(AuctionSettled {
        auction: auction.key(),
        winner: ctx.accounts.winner.key(),
        seller: auction.seller,
        nft_mint: auction.nft_mint,
        amount: total_amount,
        timestamp: current_time,
    });

    Ok(())
}
