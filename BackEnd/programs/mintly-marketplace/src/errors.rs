use anchor_lang::prelude::*;

#[error_code]
pub enum MarketplaceError {
    #[msg("Marketplace is paused")]
    MarketplacePaused,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid payment token")]
    InvalidPaymentToken,
    #[msg("Invalid auction state")]
    InvalidAuctionState,
    #[msg("Invalid listing state")]
    InvalidListingState,
    #[msg("Invalid start price")]
    InvalidStartPrice,
    #[msg("Invalid bid amount")]
    InvalidBidAmount,
    #[msg("Bid is too low")]
    BidTooLow,
    #[msg("Auction has not started")]
    AuctionNotStarted,
    #[msg("Auction has ended")]
    AuctionEnded,
    #[msg("Auction is still active")]
    AuctionStillActive,
    #[msg("Deposit deadline has passed")]
    DepositDeadlinePassed,
    #[msg("Payment deadline has passed")]
    PaymentDeadlinePassed,
    #[msg("Deposit has not been paid")]
    DepositNotPaid,
    #[msg("Deposit has already been paid")]
    AlreadyDeposited,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("NFT is already locked")]
    NFTAlreadyLocked,
    #[msg("Invalid NFT mint")]
    InvalidNFTMint,
    #[msg("Invalid escrow authority")]
    InvalidEscrowAuthority,
    #[msg("Unauthorized bidder")]
    UnauthorizedBidder,
    #[msg("Unauthorized seller")]
    UnauthorizedSeller,
    #[msg("Unauthorized winner")]
    UnauthorizedWinner,
    #[msg("Invalid deadline")]
    InvalidDeadline,
    #[msg("Invalid fee")]
    InvalidFee,
    #[msg("Math overflow")]
    Overflow,
    #[msg("Math underflow")]
    Underflow,
    #[msg("No bidder")]
    NoBidder,
    #[msg("Auction not finalized")]
    AuctionNotFinalized,
    #[msg("Settlement already completed")]
    SettlementAlreadyCompleted,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid treasury")]
    InvalidTreasury,
    #[msg("Invalid forfeiture recipient")]
    InvalidForfeitureRecipient,
    #[msg("Invalid commitment")]
    InvalidCommitment,
    #[msg("Reveal phase has not opened")]
    RevealNotOpen,
    #[msg("Reveal deadline has passed")]
    RevealDeadlinePassed,
    #[msg("Bid has already been revealed")]
    AlreadyRevealed,
    #[msg("Commitment does not match reveal")]
    InvalidReveal,
}
