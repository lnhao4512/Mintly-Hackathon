use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus, MarketplaceConfig};
use crate::constants::{CONFIG_SEED, ESCROW_SEED};
use crate::errors::MarketplaceError;
use crate::events::DepositPaid;
use crate::utils::calculate_deposit;

#[derive(Accounts)]
pub struct PayDeposit<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        mut,
        constraint = auction.status == AuctionStatus::DEPOSIT_PENDING @ MarketplaceError::InvalidAuctionState,
        constraint = auction.highest_bidder == Some(winner.key()) @ MarketplaceError::UnauthorizedWinner,
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

    pub payment_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<PayDeposit>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    
    require!(current_time <= auction.deposit_deadline, MarketplaceError::DepositDeadlinePassed);
    require!(auction.deposit_paid == 0, MarketplaceError::AlreadyDeposited);
    require!(ctx.accounts.payment_mint.key() == auction.payment_mint, MarketplaceError::InvalidPaymentToken);

    let required_deposit = calculate_deposit(auction.current_bid, ctx.accounts.config.deposit_bps)?;

    // Transfer from winner to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.winner_payment_account.to_account_info(),
        to: ctx.accounts.escrow_payment_account.to_account_info(),
        authority: ctx.accounts.winner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, required_deposit)?;

    auction.deposit_paid = required_deposit;
    auction.status = AuctionStatus::PAYMENT_PENDING;

    emit!(DepositPaid {
        auction: auction.key(),
        winner: ctx.accounts.winner.key(),
        amount: required_deposit,
        timestamp: current_time,
    });

    Ok(())
}
