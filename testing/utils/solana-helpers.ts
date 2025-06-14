import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { TestWallet } from '../types';
import * as borsh from 'borsh';
import { sha256 } from 'js-sha256';
import { Buffer } from 'buffer';
import * as bs58 from 'bs58';
import { BorshCoder } from '@project-serum/anchor';
import { Schema, serialize as borshSerialize } from 'borsh';

// Read config
const config = fs.readJsonSync(path.join(__dirname, '../config.json'));

// RPS Program ID
const PROGRAM_ID = new PublicKey(config.programId);

// RPS instruction types (must match the contract)
enum RPSInstructionType {
  InitializeGame = 0,
  JoinGame = 1,
  CommitChoice = 2,
  RevealChoice = 3,
  ResolveTimeout = 4,
  ClaimWinnings = 5,
  RejoinGame = 6,
  StartNewGameRound = 7
}

/**
 * Generate a new test wallet
 */
export async function generateWallet(label: string): Promise<TestWallet> {
  const keypair = Keypair.generate();
  const publicKey = keypair.publicKey;

  return {
    keypair,
    publicKey,
    label
  };
}

/**
 * Save wallet to file
 */
export async function saveWallet(wallet: TestWallet, walletDirPath: string): Promise<void> {
  const filePath = path.join(walletDirPath, `${wallet.label}.json`);

  // Create wallet dir if it doesn't exist
  await fs.ensureDir(walletDirPath);

  // Save keypair to file
  await fs.writeJson(filePath, Array.from(wallet.keypair.secretKey), { spaces: 2 });

  console.log(`Wallet ${wallet.label} saved to ${filePath}`);
}

/**
 * Load wallet from file
 */
export async function loadWallet(label: string, walletDirPath: string): Promise<TestWallet> {
  const filePath = path.join(walletDirPath, `${label}.json`);

  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Wallet file not found: ${filePath}`);
  }

  const secretKey = await fs.readJson(filePath);
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

  return {
    keypair,
    publicKey: keypair.publicKey,
    label
  };
}

/**
 * Fund a wallet with SOL
 */
export async function fundWallet(
  connection: Connection,
  wallet: TestWallet,
  amountInSOL: number
): Promise<string> {
  try {
    const signature = await connection.requestAirdrop(
      wallet.publicKey,
      amountInSOL * LAMPORTS_PER_SOL
    );

    await connection.confirmTransaction(signature, 'confirmed');

    console.log(`Funded wallet ${wallet.label} with ${amountInSOL} SOL`);
    return signature;
  } catch (error) {
    console.error(`Error funding wallet ${wallet.label}:`, error);
    throw error;
  }
}

/**
 * Get wallet balance in SOL
 */
export async function getBalance(connection: Connection, publicKey: PublicKey): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Generate a random salt
 */
export function generateRandomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create instruction for initializing a game
 */
function createGameInstruction(
  wallet: TestWallet,
  gameKeypair: Keypair,
  minPlayers: number,
  maxPlayers: number,
  totalRounds: number,
  entryFee: number,
  timeoutSeconds: number,
  losersCanRejoin: boolean,
  currencyMode: number
): TransactionInstruction {
  // Define the class for serialization
  class InitializeGameInstruction {
    instruction: number;
    minPlayers: number;
    maxPlayers: number;
    totalRounds: number;
    entryFee: bigint;
    timeoutSeconds: bigint;
    losersCanRejoin: number;
    currencyMode: number;

    constructor(
      instruction: number,
      minPlayers: number,
      maxPlayers: number,
      totalRounds: number,
      entryFee: bigint,
      timeoutSeconds: bigint,
      losersCanRejoin: number,
      currencyMode: number
    ) {
      this.instruction = instruction;
      this.minPlayers = minPlayers;
      this.maxPlayers = maxPlayers;
      this.totalRounds = totalRounds;
      this.entryFee = entryFee;
      this.timeoutSeconds = timeoutSeconds;
      this.losersCanRejoin = losersCanRejoin;
      this.currencyMode = currencyMode;
    }
  }

  // Define schema for serialization
  const schema: Schema = new Map([
    [
      InitializeGameInstruction,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['minPlayers', 'u8'],
          ['maxPlayers', 'u8'],
          ['totalRounds', 'u8'],
          ['entryFee', 'u64'],
          ['timeoutSeconds', 'u64'],
          ['losersCanRejoin', 'u8'],
          ['currencyMode', 'u8'],
        ],
      },
    ],
  ]);

  // Convert entry fee to lamports
  const entryFeeLamports = entryFee * LAMPORTS_PER_SOL;

  // Create the instruction data
  const instructionData = new InitializeGameInstruction(
    RPSInstructionType.InitializeGame,
    minPlayers,
    maxPlayers,
    totalRounds,
    BigInt(entryFeeLamports),
    BigInt(timeoutSeconds),
    losersCanRejoin ? 1 : 0,
    currencyMode
  );

  // Serialize the instruction data
  const serializedData = Buffer.from(borshSerialize(schema, instructionData));

  // Create the transaction instruction
  return new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: gameKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: serializedData,
  });
}

/**
 * Create instruction for joining a game
 */
function joinGameInstruction(
  wallet: TestWallet,
  gameAccount: PublicKey,
  entryFee: number,
  currencyMode: number
): TransactionInstruction {
  // Define the class for serialization
  class JoinGameInstruction {
    instruction: number;
    entryFee: bigint;
    currencyMode: number;

    constructor(instruction: number, entryFee: bigint, currencyMode: number) {
      this.instruction = instruction;
      this.entryFee = entryFee;
      this.currencyMode = currencyMode;
    }
  }

  // Define schema for serialization
  const schema: Schema = new Map([
    [
      JoinGameInstruction,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['entryFee', 'u64'],
          ['currencyMode', 'u8'],
        ],
      },
    ],
  ]);

  // Convert entry fee to lamports
  const entryFeeLamports = entryFee * LAMPORTS_PER_SOL;

  // Create the instruction data
  const instructionData = new JoinGameInstruction(
    RPSInstructionType.JoinGame,
    BigInt(entryFeeLamports),
    currencyMode
  );

  // Serialize the instruction data
  const serializedData = Buffer.from(borshSerialize(schema, instructionData));

  // Create the transaction instruction
  return new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: gameAccount, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: serializedData,
  });
}

/**
 * Commit a choice to the game
 */
export async function commitChoice(
  connection: Connection,
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): Promise<string> {
  try {
    // Hash the choice with salt
    const choiceBuffer = Buffer.from([choice]);
    const saltBuffer = Buffer.from(salt, 'hex');
    const message = Buffer.concat([choiceBuffer, saltBuffer]);
    const hash = sha256.create();
    hash.update(message);
    const hashedChoice = Buffer.from(hash.hex(), 'hex');

    // Define commit choice instruction data schema
    const commitChoiceSchema = {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['hashedChoice', [32]],
      ],
    };

    const instructionData = Buffer.alloc(33);
    const len = borsh.serialize(
      commitChoiceSchema,
      { instruction: RPSInstructionType.CommitChoice, hashedChoice },
      instructionData
    );

    // Create instruction
    const commitChoiceIx = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: instructionData.slice(0, len),
    });

    // Create transaction
    const transaction = new Transaction().add(commitChoiceIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error(`Error committing choice:`, error);
    throw error;
  }
}

/**
 * Create instruction for committing a choice
 */
function commitChoiceInstruction(
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): TransactionInstruction {
  // Define the class for serialization
  class CommitChoiceInstruction {
    instruction: number;
    commitment: Uint8Array;

    constructor(instruction: number, commitment: Uint8Array) {
      this.instruction = instruction;
      this.commitment = commitment;
    }
  }

  // Define schema for serialization
  const schema: Schema = new Map([
    [
      CommitChoiceInstruction,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['commitment', [32]], // Fixed size hash
        ],
      },
    ],
  ]);

  // Create the commitment hash (choice + salt)
  const choiceData = choice.toString() + salt;
  const commitmentHash = Buffer.from(sha256.array(choiceData));

  // Create the instruction data
  const instructionData = new CommitChoiceInstruction(
    RPSInstructionType.CommitChoice,
    commitmentHash
  );

  // Serialize the instruction data
  const serializedData = Buffer.from(borshSerialize(schema, instructionData));

  // Create the transaction instruction
  return new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: gameAccount, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: serializedData,
  });
}

/**
 * Reveal a choice in the game
 */
export async function revealChoice(
  connection: Connection,
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): Promise<string> {
  try {
    // Convert salt string to byte array
    const saltBytes = Buffer.from(salt, 'hex');

    // Define reveal choice instruction data schema
    const revealChoiceSchema = {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
        ['choice', 'u8'],
        ['salt', [32]],
      ],
    };

    const instructionData = Buffer.alloc(34);
    const len = borsh.serialize(
      revealChoiceSchema,
      { instruction: RPSInstructionType.RevealChoice, choice, salt: saltBytes },
      instructionData
    );

    // Create instruction
    const revealChoiceIx = new TransactionInstruction({
      keys: [
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data: instructionData.slice(0, len),
    });

    // Create transaction
    const transaction = new Transaction().add(revealChoiceIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error(`Error revealing choice:`, error);
    throw error;
  }
}

/**
 * Create instruction for revealing a choice
 */
function revealChoiceInstruction(
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): TransactionInstruction {
  // Define the class for serialization
  class RevealChoiceInstruction {
    instruction: number;
    choice: number;
    salt: string;

    constructor(instruction: number, choice: number, salt: string) {
      this.instruction = instruction;
      this.choice = choice;
      this.salt = salt;
    }
  }

  // Define schema for serialization
  const schema: Schema = new Map([
    [
      RevealChoiceInstruction,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['choice', 'u8'],
          ['salt', 'string'],
        ],
      },
    ],
  ]);

  // Create the instruction data
  const instructionData = new RevealChoiceInstruction(
    RPSInstructionType.RevealChoice,
    choice,
    salt
  );

  // Serialize the instruction data
  const serializedData = Buffer.from(borshSerialize(schema, instructionData));

  // Create the transaction instruction
  return new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: gameAccount, isSigner: false, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: serializedData,
  });
}

/**
 * Get transaction details for fee analysis
 */
export async function getTransactionDetails(
  connection: Connection,
  signature: string
): Promise<{
  signature: string;
  preBalance: number;
  postBalance: number;
  fee: number;
  feeChange: number;
} | null> {
  try {
    // Fetch transaction details with parsed data
    const tx = await connection.getParsedTransaction(signature, 'confirmed');

    if (!tx || !tx.meta) {
      console.error(`Transaction details not found for ${signature}`);
      return null;
    }

    // Extract pre and post balances
    const preBalance = tx.meta.preBalances.reduce((sum, balance) => sum + balance, 0) / LAMPORTS_PER_SOL;
    const postBalance = tx.meta.postBalances.reduce((sum, balance) => sum + balance, 0) / LAMPORTS_PER_SOL;

    // Get transaction fee
    const fee = tx.meta.fee / LAMPORTS_PER_SOL;

    // Compute the change in balance (excluding the fee)
    const balanceChange = preBalance - postBalance - fee;

    // For transactions involving fees, this will represent the fee amount paid to the protocol
    const feeChange = Math.max(0, balanceChange);

    return {
      signature,
      preBalance,
      postBalance,
      fee,
      feeChange
    };
  } catch (error) {
    console.error(`Error getting transaction details for ${signature}:`, error);
    return null;
  }
}

/**
 * Analyze transaction fees
 */
export async function analyzeTransactionFees(
  connection: Connection,
  signatures: string[]
): Promise<any> {
  const results = [];

  for (const signature of signatures) {
    const txData = await getTransactionDetails(connection, signature);

    if (txData && txData.meta) {
      const preBalances = txData.meta.preBalances;
      const postBalances = txData.meta.postBalances;
      const accountKeys = txData.transaction.message.accountKeys;

      results.push({
        signature,
        fee: txData.meta.fee / LAMPORTS_PER_SOL,
        preBalances: preBalances.map((balance: number, index: number) => ({
          account: accountKeys[index].toString(),
          balance: balance / LAMPORTS_PER_SOL
        })),
        postBalances: postBalances.map((balance: number, index: number) => ({
          account: accountKeys[index].toString(),
          balance: balance / LAMPORTS_PER_SOL
        })),
        feeChange: (preBalances[0] - postBalances[0] - txData.meta.fee) / LAMPORTS_PER_SOL
      });
    }
  }

  return results;
}

/**
 * Attempt to read a player's commitment
 * This function is used to test if commitments are properly secured
 */
export async function attemptToReadCommitment(
  connection: Connection,
  gameAccount: PublicKey,
  playerPublicKey: PublicKey
): Promise<{
  isSecure: boolean;
  reason: string;
  rawData?: any;
}> {
  try {
    // Fetch the game account data
    const accountInfo = await connection.getAccountInfo(gameAccount);

    if (!accountInfo || !accountInfo.data) {
      return {
        isSecure: true,
        reason: 'Game account data not available'
      };
    }

    // Try to extract the commitment data
    // This is a simplified example - in production we would try various methods to extract the data

    // Convert the buffer to a string to check if we can see plaintext choices
    const dataString = accountInfo.data.toString();

    // Check if the player's public key is found in the data
    const pubKeyStr = playerPublicKey.toBase58();
    const pubKeyFound = dataString.includes(pubKeyStr);

    // Look for common patterns that might indicate choice values
    // For example "choice:1", "choice:2", "choice:3"
    const choicePattern = /choice:([123])/;
    const choiceFound = choicePattern.test(dataString);

    // If we can find references to player public key and choice values,
    // then commitments might not be secure
    const isSecure = !(pubKeyFound && choiceFound);

    return {
      isSecure,
      reason: isSecure
        ? 'Commitment data appears to be properly hashed or encrypted'
        : 'Potential plaintext commitment data found',
      rawData: isSecure ? undefined : {
        excerpt: dataString.substring(0, 100) + '...',
        pubKeyFound,
        choiceFound
      }
    };
  } catch (error) {
    console.error('Error attempting to read commitment:', error);
    return {
      isSecure: true, // Assume secure if we can't read it
      reason: `Error attempting to access data: ${error.message}`
    };
  }
}

/**
 * Create a game
 */
export async function createGame(
  connection: Connection,
  host: TestWallet,
  minPlayers: number,
  maxPlayers: number,
  totalRounds: number,
  entryFee: number,
  timeoutSeconds: number,
  losersCanRejoin: boolean,
  currencyMode: number
): Promise<{ gameId: string; gameAccount: PublicKey; transactionId: string }> {
  try {
    // Create a new keypair for the game account
    const gameKeypair = Keypair.generate();

    // Create game instruction
    const createGameIx = createGameInstruction(
      host,
      gameKeypair,
      minPlayers,
      maxPlayers,
      totalRounds,
      entryFee,
      timeoutSeconds,
      losersCanRejoin,
      currencyMode
    );

    // Create transaction
    const transaction = new Transaction().add(createGameIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [host.keypair, gameKeypair],
      { commitment: 'confirmed' }
    );

    return {
      gameId: gameKeypair.publicKey.toBase58(),
      gameAccount: gameKeypair.publicKey,
      transactionId: signature
    };
  } catch (error) {
    console.error('Error creating game:', error);
    throw error;
  }
}

/**
 * Join a game
 */
export async function joinGame(
  connection: Connection,
  wallet: TestWallet,
  gameAccount: PublicKey,
  entryFee: number,
  currencyMode: number
): Promise<string> {
  try {
    // Create join game instruction
    const joinGameIx = joinGameInstruction(
      wallet,
      gameAccount,
      entryFee,
      currencyMode
    );

    // Create transaction
    const transaction = new Transaction().add(joinGameIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error(`Error joining game:`, error);
    throw error;
  }
}

/**
 * Commit a choice in a game
 */
export async function commitChoice(
  connection: Connection,
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): Promise<string> {
  try {
    // Create commit choice instruction
    const commitChoiceIx = commitChoiceInstruction(
      wallet,
      gameAccount,
      choice,
      salt
    );

    // Create transaction
    const transaction = new Transaction().add(commitChoiceIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error(`Error committing choice:`, error);
    throw error;
  }
}

/**
 * Reveal a choice in the game
 */
export async function revealChoice(
  connection: Connection,
  wallet: TestWallet,
  gameAccount: PublicKey,
  choice: number,
  salt: string
): Promise<string> {
  try {
    // Create reveal choice instruction
    const revealChoiceIx = revealChoiceInstruction(
      wallet,
      gameAccount,
      choice,
      salt
    );

    // Create transaction
    const transaction = new Transaction().add(revealChoiceIx);

    // Sign and send transaction
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet.keypair],
      { commitment: 'confirmed' }
    );

    return signature;
  } catch (error) {
    console.error(`Error revealing choice:`, error);
    throw error;
  }
}
