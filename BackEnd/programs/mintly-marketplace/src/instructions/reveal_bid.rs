use anchor_lang::prelude::*;
use crate::constants::{BID_COMMITMENT_SEED, CONFIG_SEED};
use crate::errors::MarketplaceError;
use crate::state::{Auction, AuctionStatus, BidCommitment, MarketplaceConfig};
use crate::utils::compute_bid_commitment;

#[derive(Accounts)]
pub struct RevealBid<'info> {
    pub bidder: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        seeds = [b"auction", auction.nft_mint.as_ref()],
        bump = auction.bump,
        constraint = (auction.status == AuctionStatus::LIVE || auction.status == AuctionStatus::REVEAL_OPEN) @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Account<'info, Auction>,

    #[account(
        mut,
        seeds = [BID_COMMITMENT_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump = bid_commitment.bump,
        constraint = bid_commitment.auction == auction.key() @ MarketplaceError::InvalidCommitment,
        constraint = bid_commitment.bidder == bidder.key() @ MarketplaceError::UnauthorizedBidder,
    )]
    pub bid_commitment: Account<'info, BidCommitment>,
}

pub fn handler(ctx: Context<RevealBid>, amount: u64, secret: [u8; 32]) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    require!(now >= auction.start_time, MarketplaceError::AuctionNotStarted);
    require!(now < auction.end_time || now < auction.reveal_deadline, MarketplaceError::AuctionEnded);
    require!(amount > 0, MarketplaceError::InvalidBidAmount);
    require!(amount >= auction.start_price, MarketplaceError::BidTooLow);

    let expected = compute_bid_commitment(amount, secret);
    let bid_commitment = &mut ctx.accounts.bid_commitment;
    require!(bid_commitment.commitment == expected, MarketplaceError::InvalidReveal);

    bid_commitment.revealed_amount = amount;
    bid_commitment.revealed = true;

    if amount > auction.current_bid {
        auction.current_bid = amount;
        auction.highest_bidder = Some(ctx.accounts.bidder.key());
    }

    Ok(())
}
