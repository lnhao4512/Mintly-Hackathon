import BN from "bn.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
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
import {
  WSOL_MINT,
  getAuctionEscrowAuthorityPda,
  getAuctionPda,
  getBidPda,
  getConfigPda,
  getListingEscrowAuthorityPda,
  getListingPda,
  getTokenConfigPda,
} from "@/lib/config";
import { normalizeSecretTo32Bytes } from "@/lib/auction-crypto";

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

export async function wrapSol(
  connection: Connection,
  wallet: WalletContextState,
  amountLamports: number
): Promise<PublicKey> {
  const owner = requireWallet(wallet);
  const ata = getAssociatedTokenAddressSync(WSOL_MINT, owner);
  const tx = new Transaction();

  const info = await connection.getAccountInfo(ata);
  if (!info) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        owner,
        ata,
        owner,
        WSOL_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  tx.add(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: ata,
      lamports: amountLamports,
    }),
    createSyncNativeInstruction(ata)
  );

  await wallet.sendTransaction(tx, connection);
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

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: seller,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  }).add(ix);

  tx.partialSign(escrowNftAccount);
  const signedTx = await wallet.signTransaction!(tx);
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

export async function createAuctionOnChain(
  connection: Connection,
  wallet: WalletContextState,
  nftMint: PublicKey,
  startPriceLamports: number,
  durationSeconds = 3 * 24 * 60 * 60
): Promise<{ signature: string; auctionPda: string }> {
  const seller = requireWallet(wallet);
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
      .initializeMarketplace(seller, seller, 250)
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

  // Sign with escrow Keypair
  tx.partialSign(escrowNftAccount);

  if (!wallet.signTransaction) {
    throw new Error("Ví không hỗ trợ ký giao dịch");
  }
  const signedTx = await wallet.signTransaction(tx);
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

export async function placeBidOnChain(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  amountLamports: number
): Promise<string> {
  const bidder = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet);
  const [configPda] = getConfigPda();
  const [bidPda] = getBidPda(auctionPda, bidder);
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
  const bidderPaymentAccount = await wrapSol(connection, wallet, amountLamports);
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

  return builder.rpc();
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

export async function payAuctionBalance(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  nftMint: PublicKey,
  seller: PublicKey,
  balanceLamports: number,
  secretStr?: string
): Promise<string> {
  const winner = requireWallet(wallet);
  const program = getMarketplaceProgram(connection, wallet) as any;
  const [configPda] = getConfigPda();
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
  
  let treasury = seller;
  try {
    const config = await program.account.marketplaceConfig.fetch(configPda);
    if (config?.treasury) {
      treasury = config.treasury as PublicKey;
    }
  } catch {}

  const winnerNftAccount = getAssociatedTokenAddressSync(nftMint, winner);

  const instructions: any[] = [];

  // 1. Ensure winner NFT ATA exists
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      winner,
      winnerNftAccount,
      winner,
      nftMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 2. Direct SOL settlement: exactly balanceLamports (e.g. 1.30 SOL) deducted from winner
  const feeLamports = Math.floor(balanceLamports * 0.025); // 2.5% marketplace fee
  const sellerLamports = balanceLamports - feeLamports;

  if (feeLamports > 0 && treasury.toBase58() !== winner.toBase58()) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: winner,
        toPubkey: treasury,
        lamports: feeLamports,
      })
    );
  }

  if (sellerLamports > 0 && seller.toBase58() !== winner.toBase58()) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: winner,
        toPubkey: seller,
        lamports: sellerLamports,
      })
    );
  }

  // 3. Execute 1 atomic transaction with fresh blockhash
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: winner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((ix) => tx.add(ix));

  if (!wallet.signTransaction) {
    throw new Error("Ví không hỗ trợ ký giao dịch");
  }

  const signedTx = await wallet.signTransaction(tx);
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

  return signature;
}

/**
 * Places bid and automatically deposits 10% into Escrow PDA.
 */
export async function placeBidWithEscrowDeposit(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  totalBidSol: number
): Promise<{ txHash: string; depositSol: number }> {
  const bidder = requireWallet(wallet);
  const [escrowAuthority] = getAuctionEscrowAuthorityPda(auctionPda);
  const depositLamports = Math.max(1000, Math.floor(totalBidSol * 1e9 * 0.10)); // 10% deposit
  const depositSol = depositLamports / 1e9;

  const instructions: any[] = [];

  // Transfer 10% deposit from bidder to Escrow PDA
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: bidder,
      toPubkey: escrowAuthority,
      lamports: depositLamports,
    })
  );

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: bidder,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((ix) => tx.add(ix));

  if (!wallet.signTransaction) {
    throw new Error("Ví không hỗ trợ ký giao dịch");
  }

  const signedTx = await wallet.signTransaction(tx);
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

  return { txHash: signature, depositSol };
}

/**
 * Winner pays remaining 90% and finalizes NFT settlement.
 */
export async function payAuctionRemainingBalance(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  nftMint: PublicKey,
  seller: PublicKey,
  totalBidSol: number
): Promise<string> {
  const winner = requireWallet(wallet);
  const [configPda] = getConfigPda();
  
  let treasury = seller;
  try {
    const program = getMarketplaceProgram(connection, wallet) as any;
    const config = await program.account.marketplaceConfig.fetch(configPda);
    if (config?.treasury) {
      treasury = config.treasury as PublicKey;
    }
  } catch {}

  const winnerNftAccount = getAssociatedTokenAddressSync(nftMint, winner);
  const instructions: any[] = [];

  // 1. Ensure winner NFT ATA exists
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      winner,
      winnerNftAccount,
      winner,
      nftMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 2. Winner pays the 90% remaining SOL balance (since 10% deposit was already locked in Escrow)
  const remaining90Lamports = Math.floor(totalBidSol * 1e9 * 0.90);
  const feeLamports = Math.floor(totalBidSol * 1e9 * 0.025); // 2.5% marketplace fee
  const sellerDirect90Lamports = Math.max(0, remaining90Lamports - feeLamports);

  if (feeLamports > 0 && treasury.toBase58() !== winner.toBase58()) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: winner,
        toPubkey: treasury,
        lamports: feeLamports,
      })
    );
  }

  if (sellerDirect90Lamports > 0 && seller.toBase58() !== winner.toBase58()) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: winner,
        toPubkey: seller,
        lamports: sellerDirect90Lamports,
      })
    );
  }

  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: winner,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  instructions.forEach((ix) => tx.add(ix));

  if (!wallet.signTransaction) {
    throw new Error("Ví không hỗ trợ ký giao dịch");
  }

  const signedTx = await wallet.signTransaction(tx);
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

  return signature;
}

/**
 * Seller claims the 10% forfeited deposit when winner defaults.
 */
export async function claimDefaultWinnerPenalty(
  connection: Connection,
  wallet: WalletContextState,
  auctionPda: PublicKey,
  sellerPubkey: PublicKey
): Promise<string> {
  const seller = requireWallet(wallet);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: seller,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  if (!wallet.signTransaction) {
    throw new Error("Ví không hỗ trợ ký giao dịch");
  }

  const signedTx = await wallet.signTransaction(tx);
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

  return signature;
}
