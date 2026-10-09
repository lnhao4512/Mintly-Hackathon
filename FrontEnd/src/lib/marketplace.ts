import BN from "bn.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { getMarketplaceProgram } from "@/utils/anchor";
import { Lg } from "@/lib/i18n";
import { assertExpectedCluster } from "@/lib/network";
import {
  WSOL_MINT,
  MARKETPLACE_FEE_BPS,
  getAuctionEscrowAuthorityPda,
  getAuctionPda,
  getBidPda,
  getConfigPda,
  getListingEscrowAuthorityPda,
  getListingPda,
  getTokenConfigPda,
  NETWORK,
} from "@/lib/config";

const NETWORK_LABEL = NETWORK === "devnet" ? "Devnet" : NETWORK;

function requireWallet(wallet: WalletContextState): PublicKey {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }
  return wallet.publicKey;
}

export async function findTokenAccount(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<PublicKey | null> {
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  const match = accounts.value.find((item) => {
    const info = item.account.data.parsed.info;
    return Number(info.tokenAmount?.amount ?? 0) > 0 || accounts.value.length === 1;
  });
  return (match ?? accounts.value[0])?.pubkey ?? null;
}

export async function ensureAta(
  connection: Connection,
  wallet: WalletContextState,
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false
): Promise<PublicKey> {
  const payer = requireWallet(wallet);
  const ata = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
  const info = await connection.getAccountInfo(ata);
  if (info) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      ata,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  await wallet.sendTransaction(tx, connection);
  return ata;
}

/**
 * Makes sure the wallet's WSOL account holds at least `amountLamports`, wrapping only the shortfall from native
 * SOL, and waits for confirmation before returning (later instructions depend on it).
 */
export async function wrapSol(
  connection: Connection,
  wallet: WalletContextState,
  amountLamports: number
): Promise<PublicKey> {
  await assertExpectedCluster(connection);
  const owner = requireWallet(wallet);
  const ata = getAssociatedTokenAddressSync(WSOL_MINT, owner);

  const info = await connection.getAccountInfo(ata);
  const have = info ? Number((await connection.getTokenAccountBalance(ata)).value.amount) : 0;
  const shortfall = Math.max(0, amountLamports - have);
  if (info && shortfall === 0) return ata;

  const FEE_BUFFER = 5_000_000; // fees + rent for a possible new token account
  const native = await connection.getBalance(owner);
  if (native < shortfall + FEE_BUFFER) {
    throw new Error(
      Lg(
        `Ví không đủ SOL trên ${NETWORK_LABEL}: cần khoảng ${((shortfall + FEE_BUFFER) / 1e9).toFixed(3)} SOL, hiện có ${(native / 1e9).toFixed(3)} SOL.`,
        `Not enough SOL on ${NETWORK_LABEL}: about ${((shortfall + FEE_BUFFER) / 1e9).toFixed(3)} SOL needed, ${(native / 1e9).toFixed(3)} SOL available.`
      )
    );
  }

  const tx = new Transaction();
  if (!info) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, WSOL_MINT, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID)
    );
  }
  if (shortfall > 0) {
    tx.add(SystemProgram.transfer({ fromPubkey: owner, toPubkey: ata, lamports: shortfall }), createSyncNativeInstruction(ata));
  }
  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return ata;
}

async function resolveEscrowPaymentAccount(
  connection: Connection,
  escrowAuthority: PublicKey
): Promise<{ address: PublicKey; signer?: Keypair }> {
  const existing = await findTokenAccount(connection, escrowAuthority, WSOL_MINT);
  if (existing) return { address: existing };
  const signer = Keypair.generate();
  return { address: signer.publicKey, signer };
}

export async function createListingOnChain(
  connection: Connection,
  wallet: WalletContextState,
  nftMint: PublicKey,
  priceLamports: number,
  expiryUnix: number
): Promise<{ signature: string; listingPda: string }> {
  const seller = requireWallet(wallet);
  await assertExpectedCluster(connection);
  const program = getMarketplaceProgram(connection, wallet);
  const [configPda] = getConfigPda();
  const [tokenConfigPda] = getTokenConfigPda(configPda);
  const [listingPda] = getListingPda(nftMint);
  const [escrowAuthority] = getListingEscrowAuthorityPda(listingPda);
  const sellerTokenAccount = getAssociatedTokenAddressSync(nftMint, seller);
  const escrowNftAccount = Keypair.generate();

  const ix = await program.methods
    .createListing(new BN(priceLamports), new BN(expiryUnix))
    .accounts({
      seller,
      config: configPda,
      tokenConfig: tokenConfigPda,
      nftMint,
      paymentMint: WSOL_MINT,
      sellerTokenAccount,
      listing: listingPda,
      escrowAuthority,
      escrowTokenAccount: escrowNftAccount.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const instructions: any[] = [];
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    const initIx = await (program.methods as any)
      .initializeMarketplace(seller, seller, MARKETPLACE_FEE_BPS)
      .accounts({
        authority: seller,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    instructions.push(initIx);
  }

  const tokenConfigInfo = await connection.getAccountInfo(tokenConfigPda);
  if (!tokenConfigInfo) {
    const addTokenIx = await (program.methods as any)
      .addToken(WSOL_MINT, 9)
      .accounts({
        authority: seller,
        config: configPda,
        tokenConfig: tokenConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    instructions.push(addTokenIx);
  }

  instructions.push(ix);

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: seller,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((instruction) => tx.add(instruction));

  const signedTx = await wallet.signTransaction!(tx);
  signedTx.partialSign(escrowNftAccount);
  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return { signature, listingPda: listingPda.toBase58() };
}

/**
 * The deployed program creates the Auction PDA with plain `init` (seeded by the NFT mint only), so a
 * mint that ever had an auction cannot get a second one — the transaction dies with "account already
 * in use", which Phantom reports as "Unexpected error". Detect it up front and say why.
 */
export async function assertAuctionCanBeCreated(connection: Connection, nftMint: PublicKey): Promise<void> {
  const [auctionPda] = getAuctionPda(nftMint);
  const info = await connection.getAccountInfo(auctionPda);
  if (!info) return;
  throw new Error(
    Lg(
      "Tác phẩm này đã từng có phiên đấu giá (đang mở, đã hủy hoặc đã chốt). Hợp đồng đang chạy trên Devnet chỉ cho mỗi NFT một phiên duy nhất; muốn mở lại phải deploy phiên bản hợp đồng mới. Hãy mint một tác phẩm khác để đấu giá.",
      "This artwork already had an auction (open, cancelled or settled). The contract deployed on Devnet allows only one auction per NFT; reopening requires deploying the updated contract. Mint a different artwork to auction."
    )
  );
}

export async function createAuctionOnChain(
  connection: Connection,
  wallet: WalletContextState,
  nftMint: PublicKey,
  startPriceLamports: number,
  durationSeconds = 3 * 24 * 60 * 60
): Promise<{ signature: string; auctionPda: string }> {
  const seller = requireWallet(wallet);
  await assertExpectedCluster(connection);
  await assertAuctionCanBeCreated(connection, nftMint);
  const program = getMarketplaceProgram(connection, wallet);
  const [configPda] = getConfigPda();
  const [tokenConfigPda] = getTokenConfigPda(configPda);
  const [auctionPda] = getAuctionPda(nftMint);
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
  const sellerTokenAccount = getAssociatedTokenAddressSync(nftMint, seller);
  const escrowNftAccount = Keypair.generate();

  const now = Math.floor(Date.now() / 1000);
  const startTime = now - 30;
  const endTime = now + durationSeconds;
  const revealDeadline = endTime + 24 * 60 * 60;
  const depositDeadline = revealDeadline + 24 * 60 * 60;
  const paymentDeadline = depositDeadline + 2 * 24 * 60 * 60;
  const minIncrement = Math.max(Math.floor(startPriceLamports * 0.05), 50_000_000);

  const ix = await program.methods
    .createAuction(
      new BN(startPriceLamports),
      new BN(minIncrement),
      new BN(startTime),
      new BN(endTime),
      new BN(revealDeadline),
      new BN(depositDeadline),
      new BN(paymentDeadline)
    )
    .accounts({
      seller,
      config: configPda,
      tokenConfig: tokenConfigPda,
      nftMint,
      paymentMint: WSOL_MINT,
      sellerTokenAccount,
      auction: auctionPda,
      escrowAuthority,
      escrowTokenAccount: escrowNftAccount.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const instructions: any[] = [];
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    const initIx = await (program.methods as any)
      .initializeMarketplace(seller, seller, MARKETPLACE_FEE_BPS)
      .accounts({
        authority: seller,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    instructions.push(initIx);
  }

  const tokenConfigInfo = await connection.getAccountInfo(tokenConfigPda);
  if (!tokenConfigInfo) {
    const addTokenIx = await (program.methods as any)
      .addToken(WSOL_MINT, 9)
      .accounts({
        authority: seller,
        config: configPda,
        tokenConfig: tokenConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    instructions.push(addTokenIx);
  }

  instructions.push(ix);

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: seller,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((i) => tx.add(i));

  if (!wallet.signTransaction) {
    throw new Error(Lg("Ví không hỗ trợ ký giao dịch", "The wallet cannot sign transactions"));
  }
  const signedTx = await wallet.signTransaction(tx);
  signedTx.partialSign(escrowNftAccount);

  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return { signature, auctionPda: auctionPda.toBase58() };
}

/**
 * Burns the 1/1 NFT held by the connected wallet and closes its (now empty) token account, returning the
 * rent. The mint account itself stays on-chain with supply 0. Returns null when the wallet holds none.
 */
export async function burnNftOnChain(
  connection: Connection,
  wallet: WalletContextState,
  nftMint: PublicKey
): Promise<string | null> {
  const owner = requireWallet(wallet);
  await assertExpectedCluster(connection);
  const ata = getAssociatedTokenAddressSync(nftMint, owner);
  const bal = await connection.getTokenAccountBalance(ata).catch(() => null);
  if (!bal || bal.value.amount === "0") return null;

  const tx = new Transaction().add(
    createBurnCheckedInstruction(ata, nftMint, owner, BigInt(bal.value.amount), bal.value.decimals),
    createCloseAccountInstruction(ata, owner, owner)
  );
  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function cancelListingOnChain(
  connection: Connection,
  wallet: WalletContextState,
  listingPda: PublicKey
): Promise<string> {
  const seller = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [escrowAuthority] = getListingEscrowAuthorityPda(listingPda);

  const listingAccount = await program.account.listing.fetch(listingPda);
  const nftMint: PublicKey = listingAccount.nftMint;

  const escrowNftAccount = await findTokenAccount(connection, escrowAuthority, nftMint);
  if (!escrowNftAccount) {
    throw new Error(Lg("Không tìm thấy tài khoản escrow NFT của tin đăng này trên Solana.", "The NFT escrow account for this listing was not found on Solana."));
  }
  const sellerNftAccount = await ensureAta(connection, wallet, nftMint, seller);

  return program.methods
    .cancelListing()
    .accounts({
      seller,
      listing: listingPda,
      escrowAuthority,
      escrowNftAccount,
      sellerNftAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function placeBidOnChain(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  amountLamports: number
): Promise<string> {
  const bidder = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [configPda] = getConfigPda();
  const [bidPda] = getBidPda(auctionPda, bidder);
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);

  const auctionAccount = await program.account.auction.fetch(auctionPda);
  if (auctionAccount.seller.equals(bidder)) {
    throw new Error(Lg("Bạn không thể đấu giá tác phẩm của chính mình.", "You cannot bid on your own auction."));
  }
  const prevBidder: PublicKey | null = auctionAccount.highestBidder ?? null;

  // Program takes a flat 10% deposit (see place_bid.rs); only wrap what's actually needed.
  const depositLamports = Math.floor((amountLamports * 10) / 100);
  const bidderPaymentAccount = await wrapSol(connection, wallet, depositLamports);
  const escrowPayment = await resolveEscrowPaymentAccount(connection, escrowAuthority);

  const builder = program.methods.placeBid(new BN(amountLamports)).accounts({
    bidder,
    config: configPda,
    auction: auctionPda,
    bid: bidPda,
    bidderPaymentAccount,
    escrowAuthority,
    escrowPaymentAccount: escrowPayment.address,
    paymentMint: WSOL_MINT,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  });

  if (escrowPayment.signer) {
    builder.signers([escrowPayment.signer]);
  }

  // The program refunds the previous highest bidder's deposit on-chain; it needs their
  // WSOL account passed in as a remaining account (see place_bid.rs refund branch).
  if (prevBidder && !prevBidder.equals(bidder)) {
    const prevBidderPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, prevBidder, true);
    builder.remainingAccounts([{ pubkey: prevBidderPaymentAccount, isWritable: true, isSigner: false }]);
  }

  // The IDL marks escrow_payment_account as a signer (it is `init_if_needed`). That is only true the
  // first time, when a fresh keypair creates it. After that nobody holds its key, so it must not be
  // a signer — otherwise every bid after the first fails with "Signature verification failed".
  const ix = await builder.instruction();
  if (!escrowPayment.signer) {
    const meta = ix.keys.find((k: { pubkey: PublicKey }) => k.pubkey.equals(escrowPayment.address));
    if (meta) meta.isSigner = false;
  }
  const bidTx = new Transaction().add(ix);
  const sendOpts = escrowPayment.signer ? { signers: [escrowPayment.signer] } : undefined;

  // The program in the repo takes a 10% deposit, but the deployed Devnet build takes the full bid. Simulate first
  // and top up the WSOL account only if the program really asks for more.
  bidTx.feePayer = bidder;
  bidTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const sim = await connection.simulateTransaction(bidTx, escrowPayment.signer ? [escrowPayment.signer] : undefined);
  if (sim.value.err && (sim.value.logs ?? []).some((l) => /insufficient funds/i.test(l))) {
    await wrapSol(connection, wallet, amountLamports);
  } else if (sim.value.err) {
    throw new Error(sim.value.logs?.filter((l) => /error|failed/i.test(l)).slice(-2).join(" | ") || JSON.stringify(sim.value.err));
  }

  const signature = await wallet.sendTransaction(new Transaction().add(ix), connection, sendOpts);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function buyListingOnChain(
  connection: Connection,
  wallet: WalletContextState,
  listingPda: PublicKey,
  nftMint: PublicKey,
  seller: PublicKey,
  priceLamports: number
): Promise<string> {
  const buyer = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet);
  const [configPda] = getConfigPda();
  const [escrowAuthority] = getListingEscrowAuthorityPda(listingPda);
  const config = await program.account.marketplaceConfig.fetch(configPda);
  const treasury = config.treasury as PublicKey;

  const buyerPaymentAccount = await wrapSol(connection, wallet, priceLamports);
  const buyerNftAccount = await ensureAta(connection, wallet, nftMint, buyer);
  const treasuryPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, treasury);
  const sellerPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, seller, false);
  const escrowNftAccount = await findTokenAccount(connection, escrowAuthority, nftMint);
  if (!escrowNftAccount) {
    throw new Error("Escrow NFT account not found for this listing");
  }

  return program.methods
    .buyListing()
    .accounts({
      buyer,
      config: configPda,
      listing: listingPda,
      buyerPaymentAccount,
      escrowAuthority,
      escrowNftAccount,
      buyerNftAccount,
      treasuryPaymentAccount,
      sellerPaymentAccount,
      paymentMint: WSOL_MINT,
      nftMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

export async function payAuctionDeposit(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  depositLamports: number
): Promise<string> {
  const winner = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet);
  const [configPda] = getConfigPda();
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
  const winnerPaymentAccount = await wrapSol(connection, wallet, depositLamports);
  const escrowPaymentAccount = await findTokenAccount(connection, escrowAuthority, WSOL_MINT);
  if (!escrowPaymentAccount) {
    throw new Error("Auction escrow payment account not found");
  }

  return program.methods
    .payDeposit()
    .accounts({
      winner,
      config: configPda,
      auction: auctionPda,
      winnerPaymentAccount,
      escrowAuthority,
      escrowPaymentAccount,
      paymentMint: WSOL_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Winner pays the remaining balance (current_bid - deposit_paid) and the program
 * atomically settles fee + seller proceeds + NFT transfer, all via CPI (pay_balance.rs).
 */
export async function payAuctionBalance(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey
): Promise<string> {
  const winner = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [configPda] = getConfigPda();
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);

  const auctionAccount = await program.account.auction.fetch(auctionPda);
  const nftMint: PublicKey = auctionAccount.nftMint;
  const seller: PublicKey = auctionAccount.seller;
  const currentBid: BN = auctionAccount.currentBid;
  const depositPaid: BN = auctionAccount.depositPaid;
  const remainingToPayLamports = currentBid.sub(depositPaid).toNumber();

  const configAccount = await program.account.marketplaceConfig.fetch(configPda);
  const treasury: PublicKey = configAccount.treasury;

  const winnerPaymentAccount = remainingToPayLamports > 0
    ? await wrapSol(connection, wallet, remainingToPayLamports)
    : await ensureAta(connection, wallet, WSOL_MINT, winner);
  const winnerNftAccount = await ensureAta(connection, wallet, nftMint, winner);

  const escrowPaymentAccount = await findTokenAccount(connection, escrowAuthority, WSOL_MINT);
  const escrowNftAccount = await findTokenAccount(connection, escrowAuthority, nftMint);
  if (!escrowPaymentAccount || !escrowNftAccount) {
    throw new Error(Lg("Không tìm thấy tài khoản escrow của phiên đấu giá này trên Solana.", "The escrow account for this auction was not found on Solana."));
  }

  const treasuryPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, treasury, true);
  const sellerPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, seller, true);

  // The IDL for pay_balance takes no arguments; the program settles at auction.current_bid.
  return program.methods
    .payBalance()
    .accounts({
      winner,
      config: configPda,
      auction: auctionPda,
      winnerPaymentAccount,
      escrowAuthority,
      escrowPaymentAccount,
      escrowNftAccount,
      winnerNftAccount,
      treasuryPaymentAccount,
      sellerPaymentAccount,
      paymentMint: WSOL_MINT,
      nftMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Forfeits the winner's 10% escrow deposit (70% to the seller, 30% to the platform's
 * forfeiture recipient) when they fail to pay the remaining balance before the payment deadline (default_winner.rs).
 */
export async function defaultWinnerOnChain(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey
): Promise<string> {
  requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [configPda] = getConfigPda();
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);

  const configAccount = await program.account.marketplaceConfig.fetch(configPda);
  const forfeitureRecipient: PublicKey = configAccount.forfeitureRecipient;

  const escrowPaymentAccount = await findTokenAccount(connection, escrowAuthority, WSOL_MINT);
  if (!escrowPaymentAccount) {
    throw new Error(Lg("Không tìm thấy tài khoản escrow của phiên đấu giá này trên Solana.", "The escrow account for this auction was not found on Solana."));
  }
  const forfeiturePaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, forfeitureRecipient, true);

  // 70% of the forfeited deposit compensates the seller (no-show insurance) — see default_winner.rs
  const auctionAccount = await program.account.auction.fetch(auctionPda);
  const sellerPaymentAccount = await ensureAta(connection, wallet, WSOL_MINT, auctionAccount.seller, true);

  return program.methods
    .defaultWinner()
    .accounts({
      config: configPda,
      auction: auctionPda,
      escrowAuthority,
      escrowPaymentAccount,
      forfeiturePaymentAccount,
      sellerPaymentAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Seller cancels their own auction and gets the NFT back — only allowed while DRAFT/NO_BID,
 * or LIVE with no bids yet (cancel_auction.rs).
 */
export async function cancelAuctionOnChain(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey
): Promise<string> {
  const seller = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);

  const auctionAccount = await program.account.auction.fetch(auctionPda);
  const nftMint: PublicKey = auctionAccount.nftMint;

  const escrowNftAccount = await findTokenAccount(connection, escrowAuthority, nftMint);
  if (!escrowNftAccount) {
    throw new Error(Lg("Không tìm thấy tài khoản escrow NFT của phiên đấu giá này trên Solana.", "The NFT escrow account for this auction was not found on Solana."));
  }
  const sellerNftAccount = await ensureAta(connection, wallet, nftMint, seller);

  return program.methods
    .cancelAuction()
    .accounts({
      seller,
      auction: auctionPda,
      escrowAuthority,
      escrowNftAccount,
      sellerNftAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
}

/**
 * Marketplace authority pauses/unpauses new listings & bids (pause_marketplace.rs / unpause_marketplace.rs).
 */
export async function setMarketplacePaused(
  connection: Connection,
  wallet: WalletContextState,
  paused: boolean
): Promise<string> {
  const authority = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [configPda] = getConfigPda();

  const method = paused ? program.methods.pauseMarketplace() : program.methods.unpauseMarketplace();
  return method.accounts({ authority, config: configPda }).rpc();
}
