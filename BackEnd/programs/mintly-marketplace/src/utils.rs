use anchor_lang::prelude::*;
use crate::constants::BPS_DENOMINATOR;
use crate::errors::MarketplaceError;

pub fn calculate_fee(amount: u64, fee_bps: u16) -> Result<u64> {
    let fee = amount
        .checked_mul(fee_bps as u64)
        .ok_or(MarketplaceError::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MarketplaceError::Underflow)?;
    Ok(fee)
}

pub fn calculate_deposit(amount: u64, deposit_bps: u16) -> Result<u64> {
    let deposit = amount
        .checked_mul(deposit_bps as u64)
        .ok_or(MarketplaceError::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MarketplaceError::Underflow)?;
    Ok(deposit)
}

pub fn calculate_balance(amount: u64, deposit_paid: u64) -> Result<u64> {
    amount.checked_sub(deposit_paid).ok_or(MarketplaceError::Underflow.into())
}

pub fn validate_deadline(current_time: i64, deadline: i64) -> Result<()> {
    if current_time > deadline {
        return err!(MarketplaceError::InvalidDeadline);
    }
    Ok(())
}

pub fn compute_bid_commitment(amount: u64, secret: [u8; 32]) -> [u8; 32] {
    anchor_lang::solana_program::hash::hashv(&[&amount.to_le_bytes(), &secret]).to_bytes()
}

#[cfg(test)]
mod tests {
    use super::compute_bid_commitment;

    #[test]
    fn commitment_is_deterministic_and_changes_with_amount() {
        let secret = [7u8; 32];
        let first = compute_bid_commitment(100, secret);
        assert_eq!(first, compute_bid_commitment(100, secret));
        assert_ne!(first, compute_bid_commitment(101, secret));
    }
}
