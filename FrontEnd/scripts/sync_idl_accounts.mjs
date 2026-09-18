import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getIxDisc(name) {
  return Array.from(crypto.createHash("sha256").update("global:" + name).digest().slice(0, 8));
}

function getAccDisc(name) {
  return Array.from(crypto.createHash("sha256").update("account:" + name).digest().slice(0, 8));
}

const idl = {
  address: "Cp7nRDpPothhBnSzLv8EmVGQcg4A5HCkmJorw3A3XdRq",
  metadata: {
    name: "mintly_marketplace",
    version: "0.1.0",
    spec: "0.1.0"
  },
  instructions: [
    {
      name: "initialize_marketplace",
      discriminator: getIxDisc("initialize_marketplace"),
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "config", writable: true, pda: { seeds: [{ kind: "const", value: Array.from(Buffer.from("config")) }] } },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "treasury", type: "pubkey" },
        { name: "forfeiture_recipient", type: "pubkey" },
        { name: "fee_bps", type: "u16" }
      ]
    },
    {
      name: "add_token",
      discriminator: getIxDisc("add_token"),
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "config" },
        { name: "token_config", writable: true },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "payment_mint", type: "pubkey" },
        { name: "decimals", type: "u8" }
      ]
    },
    {
      name: "create_listing",
      discriminator: getIxDisc("create_listing"),
      accounts: [
        { name: "seller", writable: true, signer: true },
        { name: "config" },
        { name: "token_config" },
        { name: "nft_mint" },
        { name: "payment_mint" },
        { name: "seller_token_account", writable: true },
        { name: "listing", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_nft_account", writable: true, signer: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "price", type: "u64" },
        { name: "expiry", type: "i64" }
      ]
    },
    {
      name: "buy_listing",
      discriminator: getIxDisc("buy_listing"),
      accounts: [
        { name: "buyer", writable: true, signer: true },
        { name: "config" },
        { name: "listing", writable: true },
        { name: "buyer_payment_account", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_nft_account", writable: true },
        { name: "buyer_nft_account", writable: true },
        { name: "treasury_payment_account", writable: true },
        { name: "seller_payment_account", writable: true },
        { name: "payment_mint" },
        { name: "nft_mint" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      args: []
    },
    {
      name: "cancel_listing",
      discriminator: getIxDisc("cancel_listing"),
      accounts: [
        { name: "seller", writable: true, signer: true },
        { name: "listing", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_nft_account", writable: true },
        { name: "seller_nft_account", writable: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      args: []
    },
    {
      name: "create_auction",
      discriminator: getIxDisc("create_auction"),
      accounts: [
        { name: "seller", writable: true, signer: true },
        { name: "config" },
        { name: "token_config" },
        { name: "nft_mint" },
        { name: "payment_mint" },
        { name: "seller_token_account", writable: true },
        { name: "auction", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_nft_account", writable: true, signer: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "start_price", type: "u64" },
        { name: "min_increment", type: "u64" },
        { name: "start_time", type: "i64" },
        { name: "end_time", type: "i64" },
        { name: "deposit_deadline", type: "i64" },
        { name: "payment_deadline", type: "i64" }
      ]
    },
    {
      name: "place_bid",
      discriminator: getIxDisc("place_bid"),
      accounts: [
        { name: "bidder", writable: true, signer: true },
        { name: "config" },
        { name: "auction", writable: true },
        { name: "bid", writable: true },
        { name: "bidder_payment_account", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_payment_account", writable: true, signer: true },
        { name: "payment_mint" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" }
      ],
      args: [
        { name: "amount", type: "u64" }
      ]
    },
    {
      name: "finalize_auction",
      discriminator: getIxDisc("finalize_auction"),
      accounts: [
        { name: "auction", writable: true },
        { name: "clock" }
      ],
      args: []
    },
    {
      name: "pay_deposit",
      discriminator: getIxDisc("pay_deposit"),
      accounts: [
        { name: "winner", writable: true, signer: true },
        { name: "config" },
        { name: "auction", writable: true },
        { name: "winner_payment_account", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_payment_account", writable: true },
        { name: "payment_mint" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      args: []
    },
    {
      name: "pay_balance",
      discriminator: getIxDisc("pay_balance"),
      accounts: [
        { name: "winner", writable: true, signer: true },
        { name: "config" },
        { name: "auction", writable: true },
        { name: "winner_payment_account", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_payment_account", writable: true },
        { name: "escrow_nft_account", writable: true },
        { name: "winner_nft_account", writable: true },
        { name: "treasury_payment_account", writable: true },
        { name: "seller_payment_account", writable: true },
        { name: "payment_mint" },
        { name: "nft_mint" },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      args: []
    },
    {
      name: "cancel_auction",
      discriminator: getIxDisc("cancel_auction"),
      accounts: [
        { name: "seller", writable: true, signer: true },
        { name: "auction", writable: true },
        { name: "escrow_authority" },
        { name: "escrow_nft_account", writable: true },
        { name: "seller_nft_account", writable: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }
      ],
      args: []
    }
  ],
  accounts: [
    { name: "MarketplaceConfig", discriminator: getAccDisc("MarketplaceConfig") },
    { name: "TokenConfig", discriminator: getAccDisc("TokenConfig") },
    { name: "Listing", discriminator: getAccDisc("Listing") },
    { name: "Auction", discriminator: getAccDisc("Auction") },
    { name: "Bid", discriminator: getAccDisc("Bid") }
  ],
  types: [
    {
      name: "MarketplaceConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "treasury", type: "pubkey" },
          { name: "forfeiture_recipient", type: "pubkey" },
          { name: "fee_bps", type: "u16" },
          { name: "deposit_bps", type: "u16" },
          { name: "paused", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "TokenConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "mint", type: "pubkey" },
          { name: "decimals", type: "u8" },
          { name: "enabled", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "Listing",
      type: {
        kind: "struct",
        fields: [
          { name: "seller", type: "pubkey" },
          { name: "nft_mint", type: "pubkey" },
          { name: "payment_mint", type: "pubkey" },
          { name: "price", type: "u64" },
          { name: "expiry", type: "i64" },
          { name: "status", type: { defined: { name: "ListingStatus" } } },
          { name: "bump", type: "u8" },
          { name: "created_at", type: "i64" }
        ]
      }
    },
    {
      name: "Auction",
      type: {
        kind: "struct",
        fields: [
          { name: "seller", type: "pubkey" },
          { name: "nft_mint", type: "pubkey" },
          { name: "payment_mint", type: "pubkey" },
          { name: "start_price", type: "u64" },
          { name: "min_increment", type: "u64" },
          { name: "current_bid", type: "u64" },
          { name: "highest_bidder", type: { option: "pubkey" } },
          { name: "start_time", type: "i64" },
          { name: "end_time", type: "i64" },
          { name: "deposit_deadline", type: "i64" },
          { name: "payment_deadline", type: "i64" },
          { name: "deposit_paid", type: "u64" },
          { name: "balance_paid", type: "u64" },
          { name: "status", type: { defined: { name: "AuctionStatus" } } },
          { name: "bump", type: "u8" },
          { name: "created_at", type: "i64" }
        ]
      }
    },
    {
      name: "Bid",
      type: {
        kind: "struct",
        fields: [
          { name: "auction", type: "pubkey" },
          { name: "bidder", type: "pubkey" },
          { name: "amount", type: "u64" },
          { name: "timestamp", type: "i64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "ListingStatus",
      type: {
        kind: "enum",
        variants: [{ name: "ACTIVE" }, { name: "CANCELLED" }, { name: "SOLD" }]
      }
    },
    {
      name: "AuctionStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "DRAFT" },
          { name: "LIVE" },
          { name: "ENDED" },
          { name: "DEPOSIT_PENDING" },
          { name: "PAYMENT_PENDING" },
          { name: "SETTLED" },
          { name: "DEFAULTED" },
          { name: "NO_BID" },
          { name: "CANCELLED" }
        ]
      }
    }
  ]
};

const feIdlPath = path.resolve(__dirname, "../src/idl/mintly_marketplace.json");
const beIdlPath = path.resolve(__dirname, "../../BackEnd/target/idl/mintly_marketplace.json");

fs.writeFileSync(feIdlPath, JSON.stringify(idl, null, 2));
fs.writeFileSync(beIdlPath, JSON.stringify(idl, null, 2));
console.log("Successfully synced IDL with all Rust instruction structs!");
