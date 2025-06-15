import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  AccountMeta,
  Signer,
  sendAndConfirmTransaction,
  SimulatedTransactionResponse,
  TransactionError,
  Commitment,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  Account as TokenAccountInfo,
  Mint,
  getMint,
} from '@solana/spl-token';
import { Buffer } from 'buffer'; // Ensure buffer is available for browser environments
import { CurrencyMode, TokenBalance } from '../types';

/* ===========================================================================
   TOKEN-SERVICE  –  Utilities for SOL & SPL-token payments, fee handling,
   and lightweight balance helpers.  The back-end program currently charges
   a 1 % fee (FEE_PERCENTAGE_NUMERATOR / FEE_PERCENTAGE_DENOMINATOR).
   All fee maths is performed in the *smallest unit* (lamports / token-decimals)
   and returned as bigint to avoid rounding issues.
   ======================================================================== */

// --- Constants ---
// Replace with your actual deployed RPS Token Mint address
// For testing, you might deploy a mock SPL token.
export const RPS_TOKEN_MINT_STRING = process.env.REACT_APP_RPS_TOKEN_MINT || 'RPSTokenMintAddressHereAbcdefg1234567890';
export const RPS_TOKEN_MINT_PUBKEY = new PublicKey(RPS_TOKEN_MINT_STRING);

// Replace with your actual Fee Collector address
export const FEE_COLLECTOR_STRING = process.env.REACT_APP_FEE_COLLECTOR_ACCOUNT || 'FeeCoLLeCToRyouNEEDtoUPDATEthiswithREALaccount111';
export const FEE_COLLECTOR_PUBKEY = new PublicKey(FEE_COLLECTOR_STRING);

// Fee percentage (e.g., 10 for 1%, 50 for 5%) based on backend (10/1000 = 1%)
const FEE_PERCENTAGE_NUMERATOR = 10;
const FEE_PERCENTAGE_DENOMINATOR = 1000;

// Transaction safety constants
const TRANSACTION_RETRY_COUNT = 3;
const TRANSACTION_RETRY_DELAY = 1000; // ms
const MINIMUM_SOL_BALANCE_FOR_RENT = 0.002; // SOL
const ESTIMATED_TRANSACTION_FEE = 0.000005 * LAMPORTS_PER_SOL; // 5000 lamports
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX_TRANSACTIONS = 5; // Max 5 transactions per window

// --- Error Handling --------------------------------------------------------------------------- //
export class TokenServiceError extends Error {
  constructor(msg: string) {
    super(`TokenService: ${msg}`);
    this.name = 'TokenServiceError';
  }
}

export class InsufficientFundsError extends TokenServiceError {
  constructor(currency: string, required: number, available: number) {
    super(`Insufficient ${currency} balance. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientFundsError';
  }
}

export class TransactionSimulationError extends TokenServiceError {
  logs?: string[];
  
  constructor(msg: string, logs?: string[]) {
    super(`Transaction simulation failed: ${msg}`);
    this.name = 'TransactionSimulationError';
    this.logs = logs;
  }
}

export class RateLimitError extends TokenServiceError {
  constructor(waitTime: number) {
    super(`Rate limit exceeded. Please wait ${waitTime}ms before trying again.`);
    this.name = 'RateLimitError';
  }
}

// --- Transaction Rate Limiting ---
// Simple in-memory rate limiter
class TransactionRateLimiter {
  private transactions: number[] = [];
  private readonly windowMs: number;
  private readonly maxTransactions: number;

  constructor(windowMs = RATE_LIMIT_WINDOW, maxTransactions = RATE_LIMIT_MAX_TRANSACTIONS) {
    this.windowMs = windowMs;
    this.maxTransactions = maxTransactions;
  }

  checkLimit(): { allowed: boolean, waitTime: number } {
    const now = Date.now();
    // Remove expired timestamps
    this.transactions = this.transactions.filter(time => now - time < this.windowMs);
    
    if (this.transactions.length < this.maxTransactions) {
      this.transactions.push(now);
      return { allowed: true, waitTime: 0 };
    }
    
    // Calculate wait time until next transaction would be allowed
    const oldestTransaction = this.transactions[0];
    const waitTime = this.windowMs - (now - oldestTransaction);
    
    return { allowed: false, waitTime: Math.max(0, waitTime) };
  }
}

// Singleton instance
const rateLimiter = new TransactionRateLimiter();

// Export aliases for compatibility
export const FEE_ACCOUNT = FEE_COLLECTOR_PUBKEY;
export const RPS_TOKEN_MINT = RPS_TOKEN_MINT_PUBKEY;

// Export helper functions
export const calculateBonusPot = (entryFee: number, currency: CurrencyMode): number => {
  if (currency === CurrencyMode.RPSTOKEN) {
    return 0.05; // 5% bonus for RPS token games
  }
  return 0;
};

export const createPaymentTransaction = (
  amount: bigint,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  currency: CurrencyMode
): Transaction => {
  const transaction = new Transaction();
  
  if (currency === CurrencyMode.SOL) {
    transaction.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: amount,
      })
    );
  }
  
  return transaction;
};

// Fix calculateFee function overload for rps-client compatibility
export function calculateFee(entryFeeAmount: number, currency: CurrencyMode): number {
  if (typeof entryFeeAmount === 'number') {
    const entryFeeBigInt = BigInt(Math.floor(entryFeeAmount * LAMPORTS_PER_SOL));
    const feeBigInt = (entryFeeBigInt * BigInt(FEE_PERCENTAGE_NUMERATOR)) / BigInt(FEE_PERCENTAGE_DENOMINATOR);
    return Number(feeBigInt) / LAMPORTS_PER_SOL;
  }
  // For bigint input (existing function)
  const feeBigInt = (BigInt(entryFeeAmount) * BigInt(FEE_PERCENTAGE_NUMERATOR)) / BigInt(FEE_PERCENTAGE_DENOMINATOR);
  return Number(feeBigInt);
}

// --- Transaction Tracking ---
// Track recent transactions to prevent duplicates
interface TrackedTransaction {
  signature?: string;
  fingerprint: string; // Unique identifier based on transaction content
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

class TransactionTracker {
  private recentTransactions: Map<string, TrackedTransaction> = new Map();
  private readonly expirationTime: number = 60000; // 1 minute
  
  addTransaction(fingerprint: string, signature?: string): void {
    this.cleanExpired();
    this.recentTransactions.set(fingerprint, {
      signature,
      fingerprint,
      timestamp: Date.now(),
      status: 'pending'
    });
  }
  
  updateStatus(fingerprint: string, status: 'confirmed' | 'failed'): void {
    const tx = this.recentTransactions.get(fingerprint);
    if (tx) {
      tx.status = status;
    }
  }
  
  isDuplicate(fingerprint: string): boolean {
    this.cleanExpired();
    const tx = this.recentTransactions.get(fingerprint);
    // Consider as duplicate if the same transaction was sent within the last minute
    // and is still pending or was confirmed
    return tx !== undefined && (tx.status === 'pending' || tx.status === 'confirmed');
  }
  
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, tx] of this.recentTransactions.entries()) {
      if (now - tx.timestamp > this.expirationTime) {
        this.recentTransactions.delete(key);
      }
    }
  }
  
  // Generate a fingerprint based on transaction details
  static generateFingerprint(
    fromPubkey: PublicKey, 
    toPubkey: PublicKey, 
    amount: bigint | number, 
    currency: CurrencyMode
  ): string {
    return `${fromPubkey.toBase58()}-${toPubkey.toBase58()}-${amount.toString()}-${currency}`;
  }
}

// Singleton instance
const txTracker = new TransactionTracker();

// --- Balance Fetching ---

/**
 * Fetches SOL balance for a given public key.
 * @param connection Solana connection object.
 * @param publicKey The public key to fetch balance for.
 * @returns Promise<number> SOL balance.
 */
export const getSolBalance = async (
  connection: Connection,
  publicKey: PublicKey,
): Promise<number> => {
  try {
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error('Error fetching SOL balance:', error);
    return 0;
  }
};

/**
 * Fetches RPS Token balance for a given public key.
 * @param connection Solana connection object.
 * @param publicKey The public key of the token owner.
 * @param rpsTokenMint The public key of the RPS token mint.
 * @returns Promise<number> RPS Token balance.
 */
export const getRPSTokenBalance = async (
  connection: Connection,
  publicKey: PublicKey,
  rpsTokenMint: PublicKey = RPS_TOKEN_MINT_PUBKEY,
): Promise<number> => {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      rpsTokenMint,
      publicKey,
      false, // allowOwnerOffCurve - typically false for PDAs, true for user wallets
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const tokenAccountInfo = await getAccount(connection, associatedTokenAddress, 'confirmed', TOKEN_PROGRAM_ID);
    const mintInfo = await getMint(connection, rpsTokenMint);
    
    return Number(tokenAccountInfo.amount) / (10 ** mintInfo.decimals);
  } catch (error) {
    // It's common for the token account not to exist, so handle this gracefully.
    if (error.message?.includes('could not find account') || error.message?.includes('Account does not exist')) {
      // console.log(`RPS Token account not found for ${publicKey.toBase58()}, balance is 0.`);
    } else {
      console.error('Error fetching RPS Token balance:', error);
    }
    return 0;
  }
};

/**
 * Fetches both SOL and RPS Token balances.
 * @param connection Solana connection object.
 * @param publicKey The public key to fetch balances for.
 * @param rpsTokenMint The public key of the RPS token mint.
 * @returns Promise<TokenBalance> Object containing SOL and RPS Token balances.
 */
export const getTokenBalances = async (
  connection: Connection,
  publicKey: PublicKey,
  rpsTokenMint: PublicKey = RPS_TOKEN_MINT_PUBKEY,
): Promise<TokenBalance> => {
  const sol = await getSolBalance(connection, publicKey);
  const rpsToken = await getRPSTokenBalance(connection, publicKey, rpsTokenMint);
  return { sol, rpsToken };
};

/**
 * Checks if a user has sufficient balance for a transaction.
 * @param connection Solana connection object
 * @param payer The transaction payer public key
 * @param amount Amount needed for the transaction (in smallest unit)
 * @param currency Currency mode (SOL or RPS Token)
 * @param mint Token mint (required for RPS Token)
 * @returns Promise<boolean> True if sufficient balance
 * @throws InsufficientFundsError if balance is insufficient
 */
export const checkSufficientBalance = async (
  connection: Connection,
  payer: PublicKey,
  amount: bigint,
  currency: CurrencyMode,
  mint?: PublicKey,
): Promise<boolean> => {
  // Validate parameters
  if (!payer) throw new TokenServiceError("Invalid payer public key");
  if (amount <= 0n) throw new TokenServiceError("Amount must be greater than 0");
  
  if (currency === CurrencyMode.SOL) {
    // For SOL, add estimated transaction fee to the required amount
    const requiredLamports = amount + BigInt(ESTIMATED_TRANSACTION_FEE);
    const balance = await connection.getBalance(payer);
    
    // Ensure minimum SOL balance is maintained for rent exemption
    const minimumSolBalance = MINIMUM_SOL_BALANCE_FOR_RENT * LAMPORTS_PER_SOL;
    const availableLamports = balance - minimumSolBalance;
    
    if (availableLamports < requiredLamports) {
      throw new InsufficientFundsError(
        'SOL', 
        Number(requiredLamports) / LAMPORTS_PER_SOL, 
        (balance - minimumSolBalance) / LAMPORTS_PER_SOL
      );
    }
    return true;
  } else if (currency === CurrencyMode.RPSTOKEN) {
    if (!mint) throw new TokenServiceError("Token mint is required for RPS Token transactions");
    
    try {
      // Check SOL balance for transaction fee
      const solBalance = await connection.getBalance(payer);
      if (solBalance < ESTIMATED_TRANSACTION_FEE) {
        throw new InsufficientFundsError(
          'SOL (for transaction fee)', 
          ESTIMATED_TRANSACTION_FEE / LAMPORTS_PER_SOL, 
          solBalance / LAMPORTS_PER_SOL
        );
      }
      
      // Check token balance
      const ata = await getAssociatedTokenAddress(mint, payer);
      try {
        const tokenAccount = await getAccount(connection, ata);
        if (tokenAccount.amount < amount) {
          const mintInfo = await getMint(connection, mint);
          const decimals = mintInfo.decimals;
          throw new InsufficientFundsError(
            'RPS Token', 
            Number(amount) / (10 ** decimals), 
            Number(tokenAccount.amount) / (10 ** decimals)
          );
        }
        return true;
      } catch (e) {
        // If account doesn't exist, balance is 0
        if (e.message?.includes('could not find account')) {
          throw new InsufficientFundsError('RPS Token', Number(amount), 0);
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof InsufficientFundsError) throw e;
      throw new TokenServiceError(`Failed to check token balance: ${e.message}`);
    }
  } else {
    throw new TokenServiceError("Unsupported currency mode");
  }
};

// --- Fee Calculation ---

/**
 * Calculates the game fee based on the entry amount.
 * Matches the backend program's fee calculation.
 * @param entryFeeAmount The amount of the entry fee.
 * @returns The calculated fee amount as bigint (smallest unit).
 */
export const calculateFee = (entryFeeAmount: bigint): bigint => {
  if (entryFeeAmount <= 0n) return 0n;
  return (entryFeeAmount * BigInt(FEE_PERCENTAGE_NUMERATOR)) /
         BigInt(FEE_PERCENTAGE_DENOMINATOR);
};

/**
 * Convenience overload for JS number inputs (returns **number**).
 */
export const calculateFeeNumber = (entryFeeAmount: number): number =>
  Number(calculateFee(BigInt(Math.floor(entryFeeAmount))));

// --- Transaction Creation ---

/**
 * Ensure an Associated Token Account exists – returns its publicKey and
 * appends an instruction to `ix` if creation is required.
 */
const getOrCreateATA = async (
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  ix: TransactionInstruction[],
): Promise<PublicKey> => {
  const ata = await getAssociatedTokenAddress(mint, owner, owner === mint /* allowOffCurve if PDA */, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    ix.push(
      createAssociatedTokenAccountInstruction(
        payer,
        ata,
        owner,
        mint,
      ),
    );
  }
  return ata;
};


interface CreateEntryFeeTransactionParams {
  connection: Connection;
  playerPublicKey: PublicKey;
  gameAccountPublicKey: PublicKey;
  entryFeeInLamportsOrSmallestUnit: bigint;
  currencyMode: CurrencyMode;
  rpsTokenMintPublicKey?: PublicKey;
}

/**
 * Simulates a transaction to check for potential errors before sending.
 * @param connection Solana connection
 * @param transaction Transaction to simulate
 * @param signers Optional signers for the transaction
 * @returns Simulation results
 * @throws TransactionSimulationError if simulation fails
 */
export const simulateTransaction = async (
  connection: Connection,
  transaction: Transaction,
  signers?: Signer[]
): Promise<SimulatedTransactionResponse> => {
  // Ensure transaction has a recent blockhash
  if (!transaction.recentBlockhash) {
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
  }
  
  // If signers are provided, sign the transaction
  if (signers && signers.length > 0) {
    transaction.sign(...signers);
  }
  
  try {
    // Simulate the transaction
    const simulation = await connection.simulateTransaction(transaction);
    
    // Check for simulation errors
    if (simulation.value.err) {
      const errorMsg = typeof simulation.value.err === 'string' 
        ? simulation.value.err 
        : JSON.stringify(simulation.value.err);
      throw new TransactionSimulationError(errorMsg, simulation.value.logs);
    }
    
    return simulation;
  } catch (error) {
    if (error instanceof TransactionSimulationError) throw error;
    throw new TransactionSimulationError(`Simulation request failed: ${error.message}`);
  }
};

/**
 * Creates a transaction for the player to pay the entry fee into the game.
 * The backend program will then internally handle splitting this into the game pot and collected fees.
 * @param params Parameters for creating the entry fee transaction.
 * @returns Promise<Transaction> The transaction to be signed and sent.
 */
export const createEntryFeeTransaction = async ({
  connection,
  playerPublicKey,
  gameAccountPublicKey,
  entryFeeInLamportsOrSmallestUnit,
  currencyMode,
  rpsTokenMintPublicKey = RPS_TOKEN_MINT_PUBKEY, // Default to global, but allow override
}: CreateEntryFeeTransactionParams): Promise<Transaction> => {
  // Validate parameters
  if (!playerPublicKey) throw new TokenServiceError("Invalid player public key");
  if (!gameAccountPublicKey) throw new TokenServiceError("Invalid game account public key");
  if (entryFeeInLamportsOrSmallestUnit < 0n) throw new TokenServiceError("Entry fee cannot be negative");
  
  // Check for duplicate transaction
  const txFingerprint = TransactionTracker.generateFingerprint(
    playerPublicKey, 
    gameAccountPublicKey, 
    entryFeeInLamportsOrSmallestUnit,
    currencyMode
  );
  
  if (txTracker.isDuplicate(txFingerprint)) {
    throw new TokenServiceError("Duplicate transaction detected. Please wait for the previous transaction to complete.");
  }
  
  // Apply rate limiting
  const rateCheck = rateLimiter.checkLimit();
  if (!rateCheck.allowed) {
    throw new RateLimitError(rateCheck.waitTime);
  }
  
  // Check if player has sufficient balance
  await checkSufficientBalance(
    connection, 
    playerPublicKey, 
    entryFeeInLamportsOrSmallestUnit, 
    currencyMode,
    currencyMode === CurrencyMode.RPSTOKEN ? rpsTokenMintPublicKey : undefined
  );

  const transaction = new Transaction();
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = playerPublicKey;

  if (currencyMode === CurrencyMode.SOL) {
    if (entryFeeInLamportsOrSmallestUnit <= 0n) {
      throw new TokenServiceError('Entry fee must be greater than 0 for SOL payments.');
    }
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: playerPublicKey,
        toPubkey: gameAccountPublicKey, // Game account receives the full entry fee
        lamports: entryFeeInLamportsOrSmallestUnit,
      }),
    );
  } else if (currencyMode === CurrencyMode.RPSTOKEN) {
    if (!rpsTokenMintPublicKey) {
      throw new TokenServiceError('RPS Token Mint Public Key is required for token payments.');
    }
    if (entryFeeInLamportsOrSmallestUnit <= 0n) {
      throw new TokenServiceError('Entry fee must be greater than 0 for token payments.');
    }

    const ix: TransactionInstruction[] = [];
    const playerAta = await getOrCreateATA(connection, playerPublicKey, playerPublicKey, rpsTokenMintPublicKey, ix);
    const gameAta = await getOrCreateATA(connection, playerPublicKey, gameAccountPublicKey, rpsTokenMintPublicKey, ix);

    ix.push(
      createTransferInstruction(
        playerAta,
        gameAta,
        playerPublicKey,
        entryFeeInLamportsOrSmallestUnit,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    ix.forEach(i => transaction.add(i));
  } else {
    throw new TokenServiceError('Unsupported currency mode.');
  }

  // Simulate transaction before returning
  try {
    await simulateTransaction(connection, transaction);
  } catch (error) {
    // Add more context to the error
    if (error instanceof TransactionSimulationError) {
      throw new TransactionSimulationError(
        `Entry fee transaction simulation failed: ${error.message}`,
        error.logs
      );
    }
    throw new TokenServiceError(`Failed to simulate entry fee transaction: ${error.message}`);
  }
  
  // Track this transaction
  txTracker.addTransaction(txFingerprint);
  
  return transaction;
};

// ------------------------------------------------------------------------------------------------
//  Higher-level helpers
// ------------------------------------------------------------------------------------------------

/**
 * Build a *batch* of transfer instructions: entry fee → game PDA **and** fee → fee collector
 * so callers can attach them to an existing transaction instead of sending two transactions.
 */
export const buildFeeTransferInstructions = async (
  connection: Connection,
  payer: PublicKey,
  gameAccount: PublicKey,
  amount: bigint,               // full entry fee
  currency: CurrencyMode,
  mint: PublicKey = RPS_TOKEN_MINT_PUBKEY,
): Promise<TransactionInstruction[]> => {
  // Validate parameters
  if (!payer) throw new TokenServiceError("Invalid payer public key");
  if (!gameAccount) throw new TokenServiceError("Invalid game account public key");
  if (amount < 0n) throw new TokenServiceError("Amount cannot be negative");
  
  // Check if player has sufficient balance for the full amount
  if (amount > 0n) {
    await checkSufficientBalance(connection, payer, amount, currency, 
      currency === CurrencyMode.RPSTOKEN ? mint : undefined);
  }
  
  const fee = calculateFee(amount);
  const potAmount = amount - fee;
  const ix: TransactionInstruction[] = [];

  if (currency === CurrencyMode.SOL) {
    // to game pot
    if (potAmount > 0n) {
      ix.push(SystemProgram.transfer({ fromPubkey: payer, toPubkey: gameAccount, lamports: potAmount }));
    }
    // to fee collector
    if (fee > 0n) {
      ix.push(SystemProgram.transfer({ fromPubkey: payer, toPubkey: FEE_COLLECTOR_PUBKEY, lamports: fee }));
    }
  } else if (currency === CurrencyMode.RPSTOKEN) {
    if (!mint) throw new TokenServiceError("Token mint is required for RPS Token transactions");
    
    const playerAta = await getOrCreateATA(connection, payer, payer, mint, ix);
    const gameAta   = await getOrCreateATA(connection, payer, gameAccount, mint, ix);
    const feeAta    = await getOrCreateATA(connection, payer, FEE_COLLECTOR_PUBKEY, mint, ix);

    if (potAmount > 0n) {
      ix.push(createTransferInstruction(playerAta, gameAta, payer, potAmount, [], TOKEN_PROGRAM_ID));
    }
    if (fee > 0n) {
      ix.push(createTransferInstruction(playerAta, feeAta, payer, fee, [], TOKEN_PROGRAM_ID));
    }
  } else {
    throw new TokenServiceError("Unsupported currency mode");
  }
  
  return ix;
};

/**
 * Thin wrapper for tournament entry (currently same as entry fee).
 * Provided for future flexibility (e.g., additional prize-pool addresses).
 */
export const createTournamentEntryTransaction = createEntryFeeTransaction;

/**
 * Sends a transaction with retry logic for common transient errors.
 * @param connection Solana connection
 * @param transaction Transaction to send
 * @param signers Signers for the transaction
 * @param options Optional sending options
 * @returns Transaction signature
 */
export const sendTransactionWithRetry = async (
  connection: Connection,
  transaction: Transaction,
  signers: Signer[],
  options?: {
    skipPreflight?: boolean;
    preflightCommitment?: Commitment;
    maxRetries?: number;
    retryDelayMs?: number;
  }
): Promise<string> => {
  const maxRetries = options?.maxRetries ?? TRANSACTION_RETRY_COUNT;
  const retryDelay = options?.retryDelayMs ?? TRANSACTION_RETRY_DELAY;
  
  // Generate fingerprint for tracking
  const txFingerprint = `${transaction.feePayer?.toBase58()}-${Date.now()}`;
  
  // Try to simulate first if not skipping preflight
  if (!options?.skipPreflight) {
    await simulateTransaction(connection, transaction, signers);
  }
  
  // Apply rate limiting
  const rateCheck = rateLimiter.checkLimit();
  if (!rateCheck.allowed) {
    throw new RateLimitError(rateCheck.waitTime);
  }
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // If not first attempt, get a new blockhash
      if (attempt > 0) {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        
        // Re-sign with the new blockhash
        transaction.signatures = [];
        if (signers.length > 0) {
          transaction.sign(...signers);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      
      // Send the transaction
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        signers,
        {
          skipPreflight: options?.skipPreflight ?? false,
          commitment: options?.preflightCommitment ?? 'confirmed',
          maxRetries: 1, // We're handling retries ourselves
        }
      );
      
      // Mark transaction as confirmed in tracker
      txTracker.updateStatus(txFingerprint, 'confirmed');
      
      return signature;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.message?.includes('blockhash not found') ||
        error.message?.includes('Transaction was not confirmed') ||
        error.message?.includes('timed out') ||
        error.message?.includes('Connection closed') ||
        error.message?.includes('rate limited');
      
      if (!isRetryable || attempt >= maxRetries) {
        // Mark transaction as failed in tracker
        txTracker.updateStatus(txFingerprint, 'failed');
        break;
      }
      
      console.warn(`Transaction attempt ${attempt + 1} failed with error: ${error.message}. Retrying...`);
    }
  }
  
  // If we get here, all retries failed
  throw new TokenServiceError(`Transaction failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
};

// --- Airdrop and Test Utilities ---

/**
 * Requests SOL airdrop for testing.
 * @param connection Solana connection object.
 * @param publicKey The public key to receive the airdrop.
 * @param amountInSol The amount of SOL to airdrop.
 * @returns Promise<string> Transaction signature of the airdrop.
 */
export const requestAirdropSOL = async (
  connection: Connection,
  publicKey: PublicKey,
  amountInSol: number = 1,
): Promise<string> => {
  if (amountInSol <= 0) throw new TokenServiceError("Airdrop amount must be positive.");
  try {
    const signature = await connection.requestAirdrop(
      publicKey,
      amountInSol * LAMPORTS_PER_SOL,
    );
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: signature,
    }, 'confirmed');
    return signature;
  } catch (error) {
    console.error('Error requesting SOL airdrop:', error);
    throw error;
  }
};

/**
 * Mocks getting free RPS tokens for testing.
 * In a real scenario, this would interact with a faucet or a pre-funded account.
 * This example simulates a transfer from a 'faucetOwner' (payer) to the recipient.
 * @param connection Solana connection object.
 * @param payer The Signer account that will pay for the transaction and owns the tokens to send.
 * @param recipientPublicKey The public key to receive the RPS tokens.
 * @param rpsTokenMintPublicKey The public key of the RPS token mint.
 * @param amount The amount of RPS tokens to send (in smallest unit).
 * @returns Promise<string> Transaction signature.
 */
export const getFreeRPSTokens = async (
  connection: Connection,
  payer: Signer, // This needs to be a Signer (e.g., Keypair)
  recipientPublicKey: PublicKey,
  amount: bigint, // Amount in smallest unit of the token
  rpsTokenMintPublicKey: PublicKey = RPS_TOKEN_MINT_PUBKEY,
): Promise<string> => {
  if (amount <= 0) throw new TokenServiceError("Token amount must be positive.");

  // Apply rate limiting
  const rateCheck = rateLimiter.checkLimit();
  if (!rateCheck.allowed) {
    throw new RateLimitError(rateCheck.waitTime);
  }

  const transaction = new Transaction();
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer.publicKey;

  // Source ATA (faucet's token account)
  const sourceAta = await getAssociatedTokenAddress(
    rpsTokenMintPublicKey,
    payer.publicKey,
  );

  // Destination ATA (recipient's token account)
  const destinationAta = await getAssociatedTokenAddress(
    rpsTokenMintPublicKey,
    recipientPublicKey,
  );

  // Create destination ATA if it doesn't exist
  const destinationAtaInfo = await connection.getAccountInfo(destinationAta);
  if (!destinationAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,      // Payer for creation
        destinationAta,       // ATA to create
        recipientPublicKey,   // Owner of the new ATA
        rpsTokenMintPublicKey,// Mint
      ),
    );
  }

  // Add transfer instruction
  transaction.add(
    createTransferInstruction(
      sourceAta,
      destinationAta,
      payer.publicKey, // Authority (owner of sourceAta)
      amount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  // Simulate the transaction first
  await simulateTransaction(connection, transaction, [payer]);

  // Generate fingerprint for tracking
  const txFingerprint = TransactionTracker.generateFingerprint(
    payer.publicKey, 
    recipientPublicKey, 
    amount,
    CurrencyMode.RPSTOKEN
  );
  txTracker.addTransaction(txFingerprint);

  // Send with retry logic
  try {
    const signature = await sendTransactionWithRetry(
      connection,
      transaction,
      [payer],
      { skipPreflight: false }
    );
    console.log(`Successfully sent ${amount} RPS tokens to ${recipientPublicKey.toBase58()}. Tx: ${signature}`);
    return signature;
  } catch (error) {
    txTracker.updateStatus(txFingerprint, 'failed');
    throw new TokenServiceError(`Failed to send RPS tokens: ${error.message}`);
  }
};

// Ensure Buffer is globally available for Borsh and Solana-Web3.js in browser
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

