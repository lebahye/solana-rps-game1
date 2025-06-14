import { Keypair, PublicKey } from '@solana/web3.js';

// Game choice options (same as in the main app)
export enum Choice {
  None = 0,
  Rock = 1,
  Paper = 2,
  Scissors = 3
}

// Game outcome types
export type GameOutcome = 'win' | 'loss' | 'tie';

// Game state enum (same as in the main app)
export enum GameState {
  WaitingForPlayers = 0,
  CommitPhase = 1,
  RevealPhase = 2,
  Finished = 3
}

// Game mode enum
export enum GameMode {
  Manual = 0,
  Automated = 1
}

// Currency mode enum
export enum CurrencyMode {
  SOL = 0,
  RPSTOKEN = 1
}

// Wallet data type for testing
export interface TestWallet {
  keypair: Keypair;
  publicKey: PublicKey;
  label: string;
}

// Game data for tracking test games
export interface TestGame {
  gameId: string;
  gameAccount: PublicKey;
  host: TestWallet;
  players: TestWallet[];
  playerChoices: Map<string, Choice>;
  playerSalts: Map<string, string>;
  wagerAmount: number;
  state: GameState;
  currencyMode: CurrencyMode;
  roundResults?: Map<string, GameOutcome>;
  transactionIds: string[];
  creationTime: number;
  completionTime?: number;
}

// Fee analysis data
export interface FeeAnalysis {
  gameId: string;
  totalWagered: number;
  totalFees: number;
  actualFeePercentage: number;
  expectedFeePercentage: number;
  difference: number;
  transactions: {
    signature: string;
    preBalance: number;
    postBalance: number;
    fee: number;
  }[];
}

// Fairness test results
export interface FairnessResult {
  totalGames: number;
  rockWins: number;
  paperWins: number;
  scissorsWins: number;
  ties: number;
  rockWinPercentage: number;
  paperWinPercentage: number;
  scissorsWinPercentage: number;
  tiePercentage: number;
  isBalanced: boolean;
  maxVariance: number;
}

// Test result summary
export interface TestSummary {
  fairness: FairnessResult;
  fees: {
    testsRun: number;
    passedTests: number;
    averageFeePercentage: number;
    maxFeeDifference: number;
  };
  security: {
    testsRun: number;
    vulnerabilitiesFound: number;
    passedTests: number;
  };
  stress: {
    maxConcurrentGames: number;
    successRate: number;
    averageLatency: number;
  };
}
