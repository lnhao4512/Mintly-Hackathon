import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MintlyMarketplace } from "../target/types/mintly_marketplace";

module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
  // Deployment script logic here if needed
  console.log("Deployed Mintly Marketplace");
};
