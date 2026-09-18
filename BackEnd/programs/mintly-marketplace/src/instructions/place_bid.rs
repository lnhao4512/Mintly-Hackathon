use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus, Bid, MarketplaceConfig, TokenConfig};
use crate::constants::{BID_SEED, CONFIG_SEED, ESCROW_SEED, TOKEN_SEED};
use crate::errors::MarketplaceError;
use crate::events::{BidPlaced, PreviousBidderRefunded};

#[derive(Accounts)]
pub struct PlaceBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MarketplaceError::MarketplacePaused
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        mut,
        constraint = auction.status == AuctionStatus::LIVE @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Box<Account<'info, Auction>>,

    #[account(
        init_if_needed,
        payer = bidder,
        space = Bid::LEN,
        seeds = [BID_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid: Box<Account<'info, Bid>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = bidder,
    )]
    pub bidder_payment_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, auction.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = bidder,
        token::mint = payment_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_payment_account: Box<Account<'info, TokenAccount>>,

    pub payment_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, PlaceBid<'info>>,
    amount: u64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    
    require!(current_time >= auction.start_time, MarketplaceError::AuctionNotStarted);
    require!(current_time < auction.end_time, MarketplaceError::AuctionEnded);
    require!(amount > 0, MarketplaceError::InvalidBidAmount);
    require!(ctx.accounts.payment_mint.key() == auction.payment_mint, MarketplaceError::InvalidPaymentToken);

    let min_bid = if auction.highest_bidder.is_none() {
        auction.start_price
    } else {
        auction.current_bid.checked_add(auction.min_increment).ok_or(MarketplaceError::Overflow)?
    };

    require!(amount >= min_bid, MarketplaceError::BidTooLow);

    let deposit_amount = amount.checked_mul(10).ok_or(MarketplaceError::Overflow)?.checked_div(100).ok_or(MarketplaceError::Underflow)?;

    // Transfer 10% deposit from bidder to escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.bidder_payment_account.to_account_info(),
        to: ctx.accounts.escrow_payment_account.to_account_info(),
        authority: ctx.accounts.bidder.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, deposit_amount)?;

    // Refund previous bidder's 10% deposit if any
    if let Some(prev_bidder) = auction.highest_bidder {
        let prev_deposit_amount = auction.deposit_paid;
        if prev_deposit_amount > 0 {
            if prev_bidder != ctx.accounts.bidder.key() {
                let remaining_accounts = ctx.remaining_accounts;
                if remaining_accounts.is_empty() {
                    return err!(MarketplaceError::InvalidTokenAccount);
                }
                let prev_bidder_account = &remaining_accounts[0];
                
                let auction_key = auction.key();
                let escrow_bump = ctx.bumps.escrow_authority;
                let seeds = &[
                    ESCROW_SEED,
                    auction_key.as_ref(),
                    &[escrow_bump],
                ];
                let signer = &[&seeds[..]];

                let refund_cpi_accounts = Transfer {
                    from: ctx.accounts.escrow_payment_account.to_account_info(),
                    to: prev_bidder_account.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                };
                let refund_cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    refund_cpi_accounts,
                    signer,
                );
                token::transfer(refund_cpi_ctx, prev_deposit_amount)?;

                emit!(PreviousBidderRefunded {
                    auction: auction.key(),
                    bidder: prev_bidder,
                    amount: prev_deposit_amount,
                    timestamp: current_time,
                });
            } else {
                let auction_key = auction.key();
                let escrow_bump = ctx.bumps.escrow_authority;
                let seeds = &[
                    ESCROW_SEED,
                    auction_key.as_ref(),
                    &[escrow_bump],
                ];
                let signer = &[&seeds[..]];

                let refund_cpi_accounts = Transfer {
                    from: ctx.accounts.escrow_payment_account.to_account_info(),
                    to: ctx.accounts.bidder_payment_account.to_account_info(),
                    authority: ctx.accounts.escrow_authority.to_account_info(),
                };
                let refund_cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    refund_cpi_accounts,
                    signer,
                );
                token::transfer(refund_cpi_ctx, prev_deposit_amount)?;
            }
        }
    }

    // Update auction state
    auction.highest_bidder = Some(ctx.accounts.bidder.key());
    auction.current_bid = amount;
    auction.deposit_paid = deposit_amount;

    // Update bid state
    let bid = &mut ctx.accounts.bid;
    bid.auction = auction.key();
    bid.bidder = ctx.accounts.bidder.key();
    bid.amount = amount;
    bid.timestamp = current_time;
    bid.bump = ctx.bumps.bid;

    emit!(BidPlaced {
        auction: auction.key(),
        bidder: ctx.accounts.bidder.key(),
        amount,
        timestamp: current_time,
    });

    Ok(())
}
