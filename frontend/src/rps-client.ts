import {
  type Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  AccountInfo,
  AccountMeta
} from '@solana/web3.js';
import * as borsh from 'borsh';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
import { struct, safeDeserialize } from './utils/fixborsh';

// Import additional types and functions for currency support
import { CurrencyMode } from './types';
import {
  calculateFee,
  calculateBonusPot,
  FEE_ACCOUNT,
  RPS_TOKEN_MINT,
  createPaymentTransaction
} from './services/token-service';

// Define schema for Borsh serialization/deserialization
enum Choice {
  None = 0,
  Rock = 1,
  Paper = 2,
  Scissors = 3
}

enum GameState {
  WaitingForPlayers = 0,
  CommitPhase = 1,
  RevealPhase = 2,
  Finished = 3
}

// RPS Instruction types
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

// Schema for Player struct
class Player {
  pubkey: Uint8Array;
  choice: number;
  committedChoice: Uint8Array;
  revealed: boolean;
  score: number;

  constructor(fields: {
    pubkey: Uint8Array,
    choice: number,
    committedChoice: Uint8Array,
    revealed: boolean,
    score: number
  }) {
    this.pubkey = fields.pubkey;
    this.choice = fields.choice;
    this.committedChoice = fields.committedChoice;
    this.revealed = fields.revealed;
    this.score = fields.score;
  }
}

// Schema for Game struct
class Game {
  host: Uint8Array;
  players: Player[];
  minPlayers: number;
  maxPlayers: number;
  state: number;
  currentRound: number;
  totalRounds: number;
  entryFee: bigint;
  gamePot: bigint;
  requiredTimeout: bigint;
  lastActionTimestamp: bigint;
  playerCount: number;
  losersCanRejoin: boolean;
  currencyMode: CurrencyMode; // Add currencyMode field

  constructor(fields: {
    host: Uint8Array,
    players: Player[],
    minPlayers: number,
    maxPlayers: number,
    state: number,
    currentRound: number,
    totalRounds: number,
    entryFee: bigint,
    gamePot: bigint,
    requiredTimeout: bigint,
    lastActionTimestamp: bigint,
    playerCount: number,
    losersCanRejoin: boolean,
    currencyMode: CurrencyMode // Include currencyMode in constructor
  }) {
    this.host = fields.host;
    this.players = fields.players;
    this.minPlayers = fields.minPlayers;
    this.maxPlayers = fields.maxPlayers;
    this.state = fields.state;
    this.currentRound = fields.currentRound;
    this.totalRounds = fields.totalRounds;
    this.entryFee = fields.entryFee;
    this.gamePot = fields.gamePot;
    this.requiredTimeout = fields.requiredTimeout;
    this.lastActionTimestamp = fields.lastActionTimestamp;
    this.playerCount = fields.playerCount;
    this.losersCanRejoin = fields.losersCanRejoin;
    this.currencyMode = fields.currencyMode; // Initialize currencyMode
  }
}

// Define borsh schemas for serialization/deserialization
const playerSchema = {
  kind: 'struct',
  fields: [
    ['pubkey', [32]],
    ['choice', 'u8'],
    ['committedChoice', [32]],
    ['revealed', 'u8'],
    ['score', 'u8'],
  ],
};

const gameSchema = {
  kind: 'struct',
  fields: [
    ['host', [32]],
    ['players', [playerSchema]],
    ['minPlayers', 'u8'],
    ['maxPlayers', 'u8'],
    ['state', 'u8'],
    ['currentRound', 'u8'],
    ['totalRounds', 'u8'],
    ['entryFee', 'u64'],
    ['gamePot', 'u64'],
    ['requiredTimeout', 'u64'],
    ['lastActionTimestamp', 'u64'],
    ['playerCount', 'u8'],
    ['losersCanRejoin', 'u8'],
    ['currencyMode', 'u8'],
  ],
};

// Create schema registry
const schema = new Map([
  [Player, playerSchema],
  [Game, gameSchema],
]);

// Create instruction data
const createInstructionData = (instruction: RPSInstructionType, data: any = null) => {
  // Instruction data layout
  const instructionSchema = {
    kind: 'struct',
    fields: [
      ['instruction', 'u8'],
      ...(data ? Object.entries(data) : []),
    ],
  };

  // Serialize instruction data
  const instructionData = Buffer.alloc(1000); // Allocate enough space
  const len = borsh.serialize(
    instructionSchema,
    { instruction, ...data },
    instructionData
  );

  return instructionData.slice(0, len);
};

// Interface for wallet integration
export interface Wallet {
  publicKey: PublicKey;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  sendTransaction: (
    transaction: Transaction,
    connection: Connection
  ) => Promise<string>;
}

// Client configuration
interface RPSClientConfig {
  onError?: (error: Error) => void;
  onStatusUpdate?: (message: string) => void;
}

// Main client class
export class RPSGameClient {
  private connection: Connection;
  private wallet: Wallet;
  private programId: PublicKey;
  private config: RPSClientConfig;
  private gameSubscriptions: Map<string, number> = new Map();

  constructor(
    connection: Connection,
    wallet: Wallet,
    programId: PublicKey,
    config: RPSClientConfig = {}
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId;
    this.config = config;
  }

  // Helper functions
  private async getProgramAccounts() {
    return await this.connection.getProgramAccounts(this.programId);
  }

  private async getGameAccount(gamePublicKey: PublicKey) {
    const accountInfo = await this.connection.getAccountInfo(gamePublicKey);
    if (!accountInfo) {
      throw new Error(`Game account not found: ${gamePublicKey.toBase58()}`);
    }
    return this.deserializeGameAccount(accountInfo.data);
  }

  private deserializeGameAccount(data: Buffer): Game {
    try {
      return safeDeserialize(schema, Game, data);
    } catch (error) {
      console.error('Error deserializing game account:', error);
      // Return a default game object with minimal data
      return new Game({
        host: new Uint8Array(32),
        players: [],
        minPlayers: 2,
        maxPlayers: 4,
        state: 0,
        currentRound: 0,
        totalRounds: 1,
        entryFee: BigInt(0),
        gamePot: BigInt(0),
        requiredTimeout: BigInt(0),
        lastActionTimestamp: BigInt(0),
        playerCount: 0,
        losersCanRejoin: false,
        currencyMode: CurrencyMode.SOL
      });
    }
  }

  private notifyStatus(message: string) {
    if (this.config.onStatusUpdate) {
      this.config.onStatusUpdate(message);
    }
  }

  private notifyError(error: Error) {
    if (this.config.onError) {
      this.config.onError(error);
    }
  }

  // Subscribe to a game account to receive updates
  public async subscribeToGameUpdates(
    gameId: string,
    onUpdate: (gameAccount: Game) => void
  ) {
    const gamePublicKey = new PublicKey(gameId);
    if (this.gameSubscriptions.has(gameId)) {
      // Unsubscribe from previous subscription
      const subscriptionId = this.gameSubscriptions.get(gameId) as number;
      this.connection.removeAccountChangeListener(subscriptionId);
    }

    const subscriptionId = this.connection.onAccountChange(
      gamePublicKey,
      (accountInfo) => {
        try {
          const gameAccount = this.deserializeGameAccount(accountInfo.data);
          onUpdate(gameAccount);
        } catch (error) {
          this.notifyError(error as Error);
        }
      }
    );

    this.gameSubscriptions.set(gameId, subscriptionId);
    return subscriptionId;
  }

  // Unsubscribe from game updates
  public unsubscribeFromGameUpdates(gameId: string) {
    if (this.gameSubscriptions.has(gameId)) {
      const subscriptionId = this.gameSubscriptions.get(gameId) as number;
      this.connection.removeAccountChangeListener(subscriptionId);
      this.gameSubscriptions.delete(gameId);
    }
  }

  // Create a new game instruction
  public async createGame(
    minPlayers: number,
    maxPlayers: number,
    totalRounds: number,
    entryFeeSol: number,
    timeoutSeconds: number,
    losersCanRejoin: boolean,
    currencyMode: CurrencyMode = CurrencyMode.SOL // Add currencyMode parameter
  ): Promise<{ gameId: string; gameAccount: Game }> {
    this.notifyStatus('Creating new game...');

    const gameKeypair = Keypair.generate();
    const initInstruction = this.createInitializeGameInstruction(
      gameKeypair.publicKey,
      minPlayers,
      maxPlayers,
      totalRounds,
      entryFeeSol,
      timeoutSeconds,
      losersCanRejoin,
      currencyMode // Pass currencyMode to the instruction
    );

    const transaction = new Transaction().add(initInstruction);

    try {
      // Sign transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      // Make sure we add the gameKeypair as a signer
      const signedTx = await this.wallet.signTransaction(transaction);
      signedTx.partialSign(gameKeypair);

      // Send transaction
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      // Calculate fee for display purposes
      const fee = calculateFee(entryFeeSol, currencyMode);
      this.notifyStatus(`Game created with ${fee.toFixed(6)} ${currencyMode === CurrencyMode.SOL ? 'SOL' : 'RPSTOKEN'} fee.`);

      // Get the created game account
      const gameAccount = await this.getGameAccount(gameKeypair.publicKey);

      this.notifyStatus('Game created successfully!');
      return {
        gameId: gameKeypair.publicKey.toString(),
        gameAccount
      };
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Update createInitializeGameInstruction to include currency mode
  private createInitializeGameInstruction(
    gameAccount: PublicKey,
    minPlayers: number,
    maxPlayers: number,
    totalRounds: number,
    entryFeeSol: number,
    timeoutSeconds: number,
    losersCanRejoin: boolean,
    currencyMode: CurrencyMode = CurrencyMode.SOL // Add currencyMode parameter
  ): TransactionInstruction {
    const entryFeeLamports = Math.round(entryFeeSol * LAMPORTS_PER_SOL);

    // Add bonus pot for RPSTOKEN games
    let adjustedEntryFee = entryFeeLamports;
    if (currencyMode === CurrencyMode.RPSTOKEN) {
      // Apply 5% bonus to the entry fee
      const bonusPotPercentage = calculateBonusPot(entryFeeSol, currencyMode);
      adjustedEntryFee = Math.round(entryFeeLamports * (1 + bonusPotPercentage));
    }

    // Create instruction data using our struct helper instead of borsh.struct directly
    const layout = struct([
      { key: 'instruction', type: 'u8' },
      { key: 'minPlayers', type: 'u8' },
      { key: 'maxPlayers', type: 'u8' },
      { key: 'totalRounds', type: 'u8' },
      { key: 'entryFee', type: 'u64' },
      { key: 'timeoutSeconds', type: 'u64' },
      { key: 'losersCanRejoin', type: 'u8' },
      { key: 'currencyMode', type: 'u8' },
      { key: 'autoRoundDelay', type: 'u64' },
      { key: 'maxAutoRounds', type: 'u64' }
    ]);

    const data = Buffer.alloc(1000);
    try {
      const length = layout.encode(
        {
          instruction: RPSInstructionType.InitializeGame,
          minPlayers,
          maxPlayers,
          totalRounds,
          entryFee: adjustedEntryFee,
          timeoutSeconds,
          losersCanRejoin: losersCanRejoin ? 1 : 0,
          currencyMode,
          autoRoundDelay: 0, // Default value
          maxAutoRounds: 0   // Default value
        },
        data
      );

      const keys = [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: FEE_ACCOUNT, isSigner: false, isWritable: true }
      ];

      // If using RPSTOKEN, include token program and mint
      if (currencyMode === CurrencyMode.RPSTOKEN) {
        keys.push({ pubkey: RPS_TOKEN_MINT, isSigner: false, isWritable: false });
      }

      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data: data.slice(0, length)
      });
    } catch (error) {
      throw new Error('Error encoding instruction data: ' + error.message);
    }
  }

  // Create a new game instruction
  private createGameInstruction(
    minPlayers: number,
    maxPlayers: number,
    totalRounds: number,
    entryFee: number,
    timeoutSeconds: number,
    losersCanRejoin: boolean,
    currencyMode: CurrencyMode = CurrencyMode.SOL
  ): TransactionInstruction {
    // Create new keypair for the game account
    const gameKeypair = Keypair.generate();

    // Define create game instruction data schema
    const createGameSchema = {
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
    };

    // Convert entry fee to lamports
    const entryFeeLamports = entryFee * LAMPORTS_PER_SOL;

    // Create buffer for instruction data
    const instructionData = Buffer.alloc(100); // Allocate enough space
    const len = borsh.serialize(
      createGameSchema,
      {
        instruction: RPSInstructionType.InitializeGame,
        minPlayers,
        maxPlayers,
        totalRounds,
        entryFee: BigInt(entryFeeLamports),
        timeoutSeconds: BigInt(timeoutSeconds),
        losersCanRejoin: losersCanRejoin ? 1 : 0,
        currencyMode,
      },
      instructionData
    );

    // Create the transaction instruction
    return new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData.slice(0, len),
    });
  }

  // Join game instruction
  private createJoinGameInstruction(
    gameAccount: PublicKey,
    entryFee: number,
    currencyMode: CurrencyMode
  ): TransactionInstruction {
    // Define join game instruction data schema using our struct helper
    const layout = struct([
      { key: 'instruction', type: 'u8' }
    ]);

    const data = Buffer.alloc(1); // 1 byte for instruction
    try {
      const length = layout.encode(
        { instruction: RPSInstructionType.JoinGame },
        data
      );

      const keys = [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ];

      // If using RPS token, add the token accounts
      if (currencyMode === CurrencyMode.RPSTOKEN) {
        keys.push({ pubkey: RPS_TOKEN_MINT, isSigner: false, isWritable: false });
      }

      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data: data.slice(0, length),
      });
    } catch (error) {
      throw new Error('Error encoding instruction data: ' + error.message);
    }
  }

  // Commit choice instruction
  private createCommitChoiceInstruction(
    gameAccount: PublicKey,
    choice: number,
    salt: string
  ): TransactionInstruction {
    if (!this.wallet || !this.wallet.publicKey) throw new Error('Wallet not connected');

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

    const instructionData = Buffer.alloc(33); // 1 byte for instruction + 32 bytes for hash
    const len = borsh.serialize(
      commitChoiceSchema,
      { instruction: RPSInstructionType.CommitChoice, hashedChoice },
      instructionData
    );

    return new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true }
      ],
      programId: this.programId,
      data: instructionData.slice(0, len)
    });
  }

  // Reveal choice instruction
  private createRevealChoiceInstruction(
    gameAccount: PublicKey,
    choice: number,
    salt: string
  ): TransactionInstruction {
    if (!this.wallet || !this.wallet.publicKey) throw new Error('Wallet not connected');

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

    const instructionData = Buffer.alloc(34); // 1 byte for instruction + 1 byte for choice + 32 bytes for salt
    const len = borsh.serialize(
      revealChoiceSchema,
      { instruction: RPSInstructionType.RevealChoice, choice, salt: saltBytes },
      instructionData
    );

    return new TransactionInstruction({
      keys: [
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccount, isSigner: false, isWritable: true }
      ],
      programId: this.programId,
      data: instructionData.slice(0, len)
    });
  }

  // Create timeout resolution instruction
  private createResolveTimeoutInstruction(
    gameAccount: PublicKey
  ): TransactionInstruction {
    // Serialize instruction data using our struct helper
    const layout = struct([
      { key: 'instruction', type: 'u8' }
    ]);

    const data = Buffer.alloc(1);
    try {
      layout.encode(
        { instruction: RPSInstructionType.ResolveTimeout },
        data
      );

      return new TransactionInstruction({
        keys: [
          { pubkey: gameAccount, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
        ],
        programId: this.programId,
        data: data
      });
    } catch (error) {
      throw new Error('Error encoding instruction data: ' + error.message);
    }
  }

  // Claim winnings instruction
  private createClaimWinningsInstruction(
    gameAccount: PublicKey
  ): TransactionInstruction {
    // Define claim winnings instruction data schema
    const claimWinningsSchema = {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
      ],
    };

    const instructionData = Buffer.alloc(1); // 1 byte for instruction
    const len = borsh.serialize(
      claimWinningsSchema,
      { instruction: RPSInstructionType.ClaimWinnings },
      instructionData
    );

    return new TransactionInstruction({
      keys: [
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData.slice(0, len),
    });
  }

  // Rejoin game instruction
  private createRejoinGameInstruction(
    gameAccount: PublicKey,
    entryFee: number,
    currencyMode: CurrencyMode
  ): TransactionInstruction {
    // Define rejoin game instruction data schema
    const rejoinGameSchema = {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
      ],
    };

    const instructionData = Buffer.alloc(1); // 1 byte for instruction
    const len = borsh.serialize(
      rejoinGameSchema,
      { instruction: RPSInstructionType.RejoinGame },
      instructionData
    );

    return new TransactionInstruction({
      keys: [
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: instructionData.slice(0, len),
    });
  }

  // Start new game round instruction
  private createStartNewGameRoundInstruction(
    gameAccount: PublicKey
  ): TransactionInstruction {
    // Define start new round instruction data schema
    const startNewRoundSchema = {
      kind: 'struct',
      fields: [
        ['instruction', 'u8'],
      ],
    };

    const instructionData = Buffer.alloc(1); // 1 byte for instruction
    const len = borsh.serialize(
      startNewRoundSchema,
      { instruction: RPSInstructionType.StartNewGameRound },
      instructionData
    );

    return new TransactionInstruction({
      keys: [
        { pubkey: gameAccount, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: instructionData.slice(0, len),
    });
  }

  // Update joinGame to support dual currency
  public async joinGame(gameId: string): Promise<Game> {
    this.notifyStatus('Joining game...');

    const gamePublicKey = new PublicKey(gameId);
    const joinInstruction = this.createJoinGameInstruction(gamePublicKey, 0, CurrencyMode.SOL);

    const transaction = new Transaction().add(joinInstruction);

    try {
      // Get game account first to verify entry fee and currency
      const gameAccount = await this.getGameAccount(gamePublicKey);
      const currencyMode = gameAccount.currencyMode || CurrencyMode.SOL;

      // Add fee payment instructions to the transaction
      const feeTransaction = createPaymentTransaction(
        gameAccount.entryFee,
        this.wallet.publicKey,
        gamePublicKey,
        currencyMode
      );

      // Combine transactions
      for (const instruction of feeTransaction.instructions) {
        transaction.add(instruction);
      }

      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      // Get updated game account
      const updatedGameAccount = await this.getGameAccount(gamePublicKey);

      this.notifyStatus('Joined game successfully!');
      return updatedGameAccount;
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Start game - only host can do this
  public async startGame(gameId: string): Promise<void> {
    // This is a convenience method - the actual game starts automatically when enough players join
    this.notifyStatus('Game will start automatically when enough players join...');

    // Just check if the game exists and is valid
    const gamePublicKey = new PublicKey(gameId);
    const gameAccount = await this.getGameAccount(gamePublicKey);

    // Verify the caller is the host
    if (gameAccount.host.toString() !== this.wallet.publicKey.toBuffer().toString()) {
      throw new Error('Only the host can start the game');
    }

    // If game isn't already in the right state, show appropriate message
    if (gameAccount.state !== GameState.WaitingForPlayers) {
      if (gameAccount.state === GameState.CommitPhase) {
        this.notifyStatus('Game has already started! Time to commit your choice.');
      } else {
        this.notifyStatus('Game has already started!');
      }
    } else if (gameAccount.players.length < gameAccount.minPlayers) {
      this.notifyStatus(`Waiting for more players (${gameAccount.players.length}/${gameAccount.minPlayers})...`);
    }
  }

  // Commit a choice
  public async commitChoice(gameId: string, choice: number, salt: string): Promise<void> {
    this.notifyStatus('Committing your choice...');

    const gamePublicKey = new PublicKey(gameId);
    const commitInstruction = this.createCommitChoiceInstruction(
      gamePublicKey,
      choice,
      salt
    );

    const transaction = new Transaction().add(commitInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('Choice committed successfully! Waiting for others...');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Reveal a choice
  public async revealChoice(gameId: string, choice: number, salt: string): Promise<void> {
    this.notifyStatus('Revealing your choice...');

    const gamePublicKey = new PublicKey(gameId);
    const revealInstruction = this.createRevealChoiceInstruction(
      gamePublicKey,
      choice,
      salt
    );

    const transaction = new Transaction().add(revealInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('Choice revealed successfully! Waiting for others...');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Resolve timeout
  public async resolveTimeout(gameId: string): Promise<void> {
    this.notifyStatus('Resolving timeout...');

    const gamePublicKey = new PublicKey(gameId);
    const timeoutInstruction = this.createResolveTimeoutInstruction(gamePublicKey);

    const transaction = new Transaction().add(timeoutInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('Timeout resolved successfully!');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Claim winnings
  public async claimWinnings(gameId: string): Promise<void> {
    this.notifyStatus('Claiming winnings...');

    const gamePublicKey = new PublicKey(gameId);
    const claimInstruction = this.createClaimWinningsInstruction(gamePublicKey);

    const transaction = new Transaction().add(claimInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('Winnings claimed successfully!');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Rejoin game
  public async rejoinGame(gameId: string): Promise<void> {
    this.notifyStatus('Rejoining game...');

    const gamePublicKey = new PublicKey(gameId);
    const rejoinInstruction = this.createRejoinGameInstruction(gamePublicKey, 0, CurrencyMode.SOL);

    const transaction = new Transaction().add(rejoinInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('Rejoined game successfully!');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Start new game round
  public async startNewGameRound(gameId: string): Promise<void> {
    this.notifyStatus('Starting new game round...');

    const gamePublicKey = new PublicKey(gameId);
    const startRoundInstruction = this.createStartNewGameRoundInstruction(gamePublicKey);

    const transaction = new Transaction().add(startRoundInstruction);

    try {
      // Sign and send transaction
      transaction.feePayer = this.wallet.publicKey;
      transaction.recentBlockhash = (
        await this.connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await this.wallet.signTransaction(transaction);
      const txId = await this.wallet.sendTransaction(signedTx, this.connection);
      await this.connection.confirmTransaction(txId, 'confirmed');

      this.notifyStatus('New game round started successfully!');
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }

  // Get all active games
  public async getAllActiveGames(): Promise<{ gameId: string; gameAccount: Game }[]> {
    this.notifyStatus('Fetching active games...');

    try {
      const accounts = await this.getProgramAccounts();
      const activeGames = [];

      for (const { pubkey, account } of accounts) {
        try {
          const gameAccount = this.deserializeGameAccount(account.data);
          // Only include games in WaitingForPlayers state
          if (gameAccount.state === GameState.WaitingForPlayers) {
            activeGames.push({
              gameId: pubkey.toString(),
              gameAccount
            });
          }
        } catch (error) {
          // Skip accounts that can't be deserialized as games
          continue;
        }
      }

      return activeGames;
    } catch (error) {
      this.notifyError(error as Error);
      throw error;
    }
  }
}
