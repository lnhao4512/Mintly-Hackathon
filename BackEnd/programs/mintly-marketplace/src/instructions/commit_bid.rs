use anchor_lang::prelude::*;
use crate::constants::{BID_COMMITMENT_SEED, CONFIG_SEED};
use crate::errors::MarketplaceError;
use crate::state::{Auction, AuctionStatus, BidCommitment, MarketplaceConfig};

#[derive(Accounts)]
#[instruction(commitment: [u8; 32])]
pub struct CommitBid<'info> {
    #[account(mut)]
    pub bidder: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MarketplaceError::MarketplacePaused
    )]
    pub config: Account<'info, MarketplaceConfig>,

    #[account(
        seeds = [b"auction", auction.nft_mint.as_ref()],
        bump = auction.bump,
        constraint = auction.status == AuctionStatus::LIVE @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Account<'info, Auction>,

    #[account(
        init_if_needed,
        payer = bidder,
        space = BidCommitment::LEN,
        seeds = [BID_COMMITMENT_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid_commitment: Account<'info, BidCommitment>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CommitBid>, commitment: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let auction = &ctx.accounts.auction;
    require!(now >= auction.start_time, MarketplaceError::AuctionNotStarted);
    require!(now < auction.end_time, MarketplaceError::AuctionEnded);
    require!(commitment != [0u8; 32], MarketplaceError::InvalidCommitment);

    let bid_commitment = &mut ctx.accounts.bid_commitment;
    bid_commitment.auction = auction.key();
    bid_commitment.bidder = ctx.accounts.bidder.key();
    bid_commitment.commitment = commitment;
    bid_commitment.revealed_amount = 0;
    bid_commitment.revealed = false;
    bid_commitment.bump = ctx.bumps.bid_commitment;
    Ok(())
}
