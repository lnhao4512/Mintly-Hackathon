import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MintlyMarketplace } from "../target/types/mintly_marketplace";
import { assert } from "chai";

describe("marketplace", () => {
  if (process.env.ANCHOR_PROVIDER_URL) {
    anchor.setProvider(anchor.AnchorProvider.env());
  }

  it("Is initialized!", async () => {
    // Basic test placeholder
    assert.ok(true);
  });
});
