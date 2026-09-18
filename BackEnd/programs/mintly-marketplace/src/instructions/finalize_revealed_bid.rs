use anchor_lang::prelude::*;
use crate::constants::{BID_COMMITMENT_SEED, CONFIG_SEED};
use crate::errors::MarketplaceError;
use crate::state::{Auction, AuctionStatus, BidCommitment, MarketplaceConfig};

#[derive(Accounts)]
pub struct FinalizeRevealedBid<'info> {
    pub authority: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, MarketplaceConfig>,

    #[account(
        mut,
        seeds = [b"auction", auction.nft_mint.as_ref()],
        bump = auction.bump,
        constraint = (auction.status == AuctionStatus::LIVE || auction.status == AuctionStatus::REVEAL_OPEN) @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Account<'info, Auction>,

    /// CHECK: The bidder key is authenticated by the commitment PDA seeds and
    /// the stored bidder field; no account data is read from this account.
    pub bidder: AccountInfo<'info>,

    #[account(
        seeds = [BID_COMMITMENT_SEED, auction.key().as_ref(), bidder.key().as_ref()],
        bump = bid_commitment.bump,
        constraint = bid_commitment.auction == auction.key() @ MarketplaceError::InvalidCommitment,
        constraint = bid_commitment.bidder == bidder.key() @ MarketplaceError::UnauthorizedBidder,
        constraint = bid_commitment.revealed @ MarketplaceError::InvalidReveal,
    )]
    pub bid_commitment: Account<'info, BidCommitment>,
}

pub fn handler(ctx: Context<FinalizeRevealedBid>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;
    require!(now >= auction.reveal_deadline, MarketplaceError::RevealDeadlinePassed);
    require!(ctx.accounts.bid_commitment.revealed_amount > auction.current_bid, MarketplaceError::BidTooLow);

    auction.current_bid = ctx.accounts.bid_commitment.revealed_amount;
    auction.highest_bidder = Some(ctx.accounts.bid_commitment.bidder);
    auction.status = AuctionStatus::DEPOSIT_PENDING;
    Ok(())
}
