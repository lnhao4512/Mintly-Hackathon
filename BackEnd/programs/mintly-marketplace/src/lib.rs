use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
pub mod utils;

use instructions::*;

declare_id!("Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq");

#[program]
pub mod mintly_marketplace {
    use super::*;

    pub fn initialize_marketplace(
        ctx: Context<InitializeMarketplace>,
        treasury: Pubkey,
        forfeiture_recipient: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_marketplace::handler(ctx, treasury, forfeiture_recipient, fee_bps)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_treasury: Option<Pubkey>,
        new_forfeiture_recipient: Option<Pubkey>,
        new_fee_bps: Option<u16>,
        new_deposit_bps: Option<u16>,
    ) -> Result<()> {
        instructions::update_config::handler(ctx, new_treasury, new_forfeiture_recipient, new_fee_bps, new_deposit_bps)
    }

    pub fn pause_marketplace(ctx: Context<PauseMarketplace>) -> Result<()> {
        instructions::pause_marketplace::handler(ctx)
    }

    pub fn unpause_marketplace(ctx: Context<UnpauseMarketplace>) -> Result<()> {
        instructions::unpause_marketplace::handler(ctx)
    }

    pub fn add_token(ctx: Context<AddToken>, payment_mint: Pubkey, decimals: u8) -> Result<()> {
        instructions::manage_token::add_token_handler(ctx, payment_mint, decimals)
    }

    pub fn remove_token(ctx: Context<RemoveToken>) -> Result<()> {
        instructions::manage_token::remove_token_handler(ctx)
    }

    // NFT minting happens off-chain via Metaplex/Umi on the frontend.
    // The Anchor program only coordinates escrow, listing, and auction workflows
    // once the FE-created NFT mint is transferred into the program-owned escrow account.
    pub fn create_auction(
        ctx: Context<CreateAuction>,
        start_price: u64,
        min_increment: u64,
        start_time: i64,
        end_time: i64,
        reveal_deadline: i64,
        deposit_deadline: i64,
        payment_deadline: i64,
    ) -> Result<()> {
        instructions::create_auction::handler(
            ctx,
            start_price,
            min_increment,
            start_time,
            end_time,
            reveal_deadline,
            deposit_deadline,
            payment_deadline,
        )
    }

    pub fn place_bid<'info>(ctx: Context<'_, '_, '_, 'info, PlaceBid<'info>>, amount: u64) -> Result<()> {
        instructions::place_bid::handler(ctx, amount)
    }

    pub fn commit_bid(ctx: Context<CommitBid>, commitment: [u8; 32]) -> Result<()> {
        instructions::commit_bid::handler(ctx, commitment)
    }

    pub fn reveal_bid(ctx: Context<RevealBid>, amount: u64, secret: [u8; 32]) -> Result<()> {
        instructions::reveal_bid::handler(ctx, amount, secret)
    }

    pub fn finalize_revealed_bid(ctx: Context<FinalizeRevealedBid>) -> Result<()> {
        instructions::finalize_revealed_bid::handler(ctx)
    }

    pub fn finalize_auction(ctx: Context<FinalizeAuction>) -> Result<()> {
        instructions::finalize_auction::handler(ctx)
    }

    pub fn pay_deposit(ctx: Context<PayDeposit>) -> Result<()> {
        instructions::pay_deposit::handler(ctx)
    }

    pub fn pay_balance(ctx: Context<PayBalance>, amount: u64) -> Result<()> {
        instructions::pay_balance::handler(ctx, amount)
    }

    pub fn default_winner(ctx: Context<DefaultWinner>) -> Result<()> {
        instructions::default_winner::handler(ctx)
    }

    pub fn cancel_auction(ctx: Context<CancelAuction>) -> Result<()> {
        instructions::cancel_auction::handler(ctx)
    }

    pub fn create_listing(
        ctx: Context<CreateListing>,
        price: u64,
        expiry: i64,
    ) -> Result<()> {
        instructions::create_listing::handler(ctx, price, expiry)
    }

    pub fn buy_listing(ctx: Context<BuyListing>) -> Result<()> {
        instructions::buy_listing::handler(ctx)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handler(ctx)
    }
}
