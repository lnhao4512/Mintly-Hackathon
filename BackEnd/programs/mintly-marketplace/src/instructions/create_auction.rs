use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Auction, AuctionStatus, MarketplaceConfig, TokenConfig};
use crate::constants::{AUCTION_SEED, CONFIG_SEED, ESCROW_SEED, TOKEN_SEED};
use crate::errors::MarketplaceError;
use crate::events::AuctionCreated;

#[derive(Accounts)]
pub struct CreateAuction<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ MarketplaceError::MarketplacePaused
    )]
    pub config: Box<Account<'info, MarketplaceConfig>>,

    #[account(
        seeds = [TOKEN_SEED, config.key().as_ref(), payment_mint.key().as_ref()],
        bump = token_config.bump,
        constraint = token_config.enabled @ MarketplaceError::InvalidPaymentToken
    )]
    pub token_config: Box<Account<'info, TokenConfig>>,

    // FE mints the NFT externally with Metaplex; Anchor receives the mint and locks it
    // into the escrow token account for auction settlement.
    pub nft_mint: Box<Account<'info, Mint>>,
    pub payment_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
        constraint = seller_token_account.amount >= 1 @ MarketplaceError::NFTAlreadyLocked,
    )]
    pub seller_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = seller,
        space = Auction::LEN,
        seeds = [AUCTION_SEED, nft_mint.key().as_ref()],
        bump
    )]
    pub auction: Box<Account<'info, Auction>>,

    /// CHECK: PDA for escrow authority
    #[account(
        seeds = [ESCROW_SEED, auction.key().as_ref()],
        bump
    )]
    pub escrow_authority: AccountInfo<'info>,

    #[account(
        init,
        payer = seller,
        token::mint = nft_mint,
        token::authority = escrow_authority,
    )]
    pub escrow_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateAuction>,
    start_price: u64,
    min_increment: u64,
    start_time: i64,
    end_time: i64,
    reveal_deadline: i64,
    deposit_deadline: i64,
    payment_deadline: i64,
) -> Result<()> {
    require!(start_price > 0, MarketplaceError::InvalidStartPrice);
    require!(end_time > start_time, MarketplaceError::InvalidDeadline);
    require!(reveal_deadline > end_time, MarketplaceError::InvalidDeadline);
    require!(deposit_deadline > reveal_deadline, MarketplaceError::InvalidDeadline);
    require!(payment_deadline > deposit_deadline, MarketplaceError::InvalidDeadline);

    let auction = &mut ctx.accounts.auction;
    
    // If re-using an existing auction account (secondary auction after purchase/settlement),
    // ensure the previous auction is no longer active
    if auction.created_at > 0 {
        require!(
            auction.status == AuctionStatus::SETTLED || auction.status == AuctionStatus::CANCELLED,
            MarketplaceError::AuctionStillActive
        );
    }
    auction.seller = ctx.accounts.seller.key();
    auction.nft_mint = ctx.accounts.nft_mint.key();
    auction.payment_mint = ctx.accounts.payment_mint.key();
    auction.start_price = start_price;
    auction.min_increment = min_increment;
    auction.current_bid = 0;
    auction.highest_bidder = None;
    auction.start_time = start_time;
    auction.end_time = end_time;
    auction.reveal_deadline = reveal_deadline;
    auction.deposit_deadline = deposit_deadline;
    auction.payment_deadline = payment_deadline;
    auction.deposit_paid = 0;
    auction.balance_paid = 0;
    auction.status = AuctionStatus::DRAFT;
    auction.bump = ctx.bumps.auction;
    auction.created_at = Clock::get()?.unix_timestamp;

    // Lock NFT into escrow
    let cpi_accounts = Transfer {
        from: ctx.accounts.seller_token_account.to_account_info(),
        to: ctx.accounts.escrow_token_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, 1)?;

    // Status goes LIVE if start_time is correct or draft, let's say LIVE immediately if we just created it or wait for start time
    // For simplicity, we just set DRAFT, but usually if it's created, it can be considered LIVE once start_time <= current
    auction.status = AuctionStatus::LIVE; // Assuming creation means making it live

    emit!(AuctionCreated {
        auction: auction.key(),
        seller: auction.seller,
        nft_mint: auction.nft_mint,
        payment_mint: auction.payment_mint,
        start_price,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
