use anchor_lang::prelude::*;
use crate::state::{Auction, AuctionStatus};
use crate::errors::MarketplaceError;
use crate::events::AuctionFinalized;

#[derive(Accounts)]
pub struct FinalizeAuction<'info> {
    #[account(
        mut,
        constraint = auction.status == AuctionStatus::LIVE || auction.status == AuctionStatus::REVEAL_OPEN @ MarketplaceError::InvalidAuctionState,
    )]
    pub auction: Account<'info, Auction>,
}

pub fn handler(ctx: Context<FinalizeAuction>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    let auction = &mut ctx.accounts.auction;

    if auction.status == AuctionStatus::LIVE {
        require!(current_time >= auction.end_time, MarketplaceError::AuctionStillActive);

        if auction.highest_bidder.is_some() {
            auction.status = AuctionStatus::DEPOSIT_PENDING;
        } else {
            auction.status = AuctionStatus::REVEAL_OPEN;
        }
    } else {
        require!(current_time >= auction.reveal_deadline, MarketplaceError::RevealDeadlinePassed);
        auction.status = if auction.highest_bidder.is_some() {
            AuctionStatus::DEPOSIT_PENDING
        } else {
            AuctionStatus::NO_BID
        };
    }

    emit!(AuctionFinalized {
        auction: auction.key(),
        status: auction.status.clone(),
        timestamp: current_time,
    });

    Ok(())
}
