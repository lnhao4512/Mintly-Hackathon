use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus, MarketplaceConfig};
use crate::constants::{BPS_DENOMINATOR, CONFIG_SEED, ESCROW_SEED, SELLER_FORFEIT_BPS};
use crate::errors::MarketplaceError;
use crate::events::AuctionDefaulted;

#[derive(Accounts)]
pub struct DefaultWinner<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        mut,
        constraint = (auction.status == AuctionStatus::LIVE || auction.status == AuctionStatus::DEPOSIT_PENDING || auction.status == AuctionStatus::PAYMENT_PENDING || auction.status == AuctionStatus::ENDED) @ MarketplaceError::InvalidAuctionState,
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
        token::mint = auction.payment_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = auction.payment_mint,
        token::authority = config.forfeiture_recipient,
    )]
    pub forfeiture_payment_account: Box<Account<'info, TokenAccount>>,

    /// Seller's token account — receives the no-show compensation.
    #[account(
        mut,
        token::mint = auction.payment_mint,
        token::authority = auction.seller,
    )]
    pub seller_payment_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<DefaultWinner>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    
    if auction.status == AuctionStatus::PAYMENT_PENDING {
        require!(current_time > auction.payment_deadline, MarketplaceError::InvalidDeadline);
        
        let deposit_paid = auction.deposit_paid;
        if deposit_paid > 0 {
            let auction_key = auction.key();
            let escrow_bump = ctx.bumps.escrow_authority;
            let seeds = &[
                ESCROW_SEED,
                auction_key.as_ref(),
                &[escrow_bump],
            ];
            let signer = &[&seeds[..]];

            let seller_share = deposit_paid
                .checked_mul(SELLER_FORFEIT_BPS)
                .ok_or(MarketplaceError::Overflow)?
                .checked_div(BPS_DENOMINATOR)
                .ok_or(MarketplaceError::Underflow)?;
            let platform_share = deposit_paid
                .checked_sub(seller_share)
                .ok_or(MarketplaceError::Underflow)?;

            if seller_share > 0 {
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_payment_account.to_account_info(),
                        to: ctx.accounts.seller_payment_account.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer,
                );
                token::transfer(cpi_ctx, seller_share)?;
            }
            if platform_share > 0 {
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_payment_account.to_account_info(),
                        to: ctx.accounts.forfeiture_payment_account.to_account_info(),
                        authority: ctx.accounts.escrow_authority.to_account_info(),
                    },
                    signer,
                );
                token::transfer(cpi_ctx, platform_share)?;
            }
        }
    } else if auction.status == AuctionStatus::DEPOSIT_PENDING {
        require!(current_time > auction.deposit_deadline, MarketplaceError::InvalidDeadline);
        // Deposit not paid yet, nothing to forfeit. Just fail the auction.
    }

    auction.status = AuctionStatus::DEFAULTED;

    emit!(AuctionDefaulted {
        auction: auction.key(),
        timestamp: current_time,
    });

    Ok(())
}
