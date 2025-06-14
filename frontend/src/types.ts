// Game view states for the application
import { PublicKey } from '@solana/web3.js';

// Add global declarations for TypeScript
declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: any;
  }
}

export enum GameView {
  HOME = 'HOME',
  CREATE_GAME = 'CREATE_GAME',
  JOIN_GAME = 'JOIN_GAME',
  GAME_LOBBY = 'GAME_LOBBY',
  COMMIT_CHOICE = 'COMMIT_CHOICE',
  REVEAL_CHOICE = 'REVEAL_CHOICE',
  GAME_RESULTS = 'GAME_RESULTS',
  AUTO_PLAY = 'AUTO_PLAY', // Auto-play mode
  SECURITY = 'SECURITY', // Security information
  TESTING = 'TESTING', // Testing view
  TOURNAMENT = 'TOURNAMENT', // Tournament bracket view
  PROFILE = 'PROFILE', // New profile view
}

// Game states as defined in the Solana program
// Must stay in sync with backend/solana-program/src/lib.rs `GameState`
export enum GameState {
  WaitingForPlayers = 0,
  CommitPhase = 1,
  RevealPhase = 2,
  Finished = 3,
}

// Game modes
export enum GameMode {
  Manual = 0,
  Automated = 1
}

// Currency mode
export enum CurrencyMode {
  SOL = 'SOL',
  RPS_TOKEN = 'RPS_TOKEN',
  RPSTOKEN = 'RPSToken', // Align with backend discriminator name
  NEW_CURRENCY = 2 // Extended CurrencyMode enum
}

/* ------------------------------------------------------------------ */
/* Tournament-related UI / state types (fully on-chain)               */
/* ------------------------------------------------------------------ */

// Views dedicated to tournament flow
export enum TournamentView {
  TOURNAMENT_HOME = 'TOURNAMENT_HOME',
  TOURNAMENT_LOBBY = 'TOURNAMENT_LOBBY',
  TOURNAMENT_BRACKETS = 'TOURNAMENT_BRACKETS',
}

// Matches backend `TournamentState.status`
export enum TournamentStatus {
  Registering = 'Registering',
  Seeding = 'Seeding',
  InProgress = 'InProgress',
  Paused = 'Paused',
  Finished = 'Finished',
  Cancelled = 'Cancelled',
}

export interface TournamentPlayer {
  pubkey: PublicKey;
  name?: string;
}

export interface Match {
  id: string;
  roundIndex: number;
  matchIndex: number;
  player1: TournamentPlayer | null;
  player2: TournamentPlayer | null;
  winner: TournamentPlayer | null;
  status: 'Pending' | 'Scheduled' | 'InProgress' | 'Completed' | 'Bye';
  gameId?: string; // Underlying RPS game PDA
}

export interface TournamentRound {
  roundNumber: number;
  matches: Match[];
}

// Mirrors on-chain TournamentState struct
export interface TournamentState {
  host: PublicKey;
  maxPlayers: number;
  entryFee: bigint;            // u64 on-chain
  currencyMode: CurrencyMode;  // 0 = SOL, 1 = RPSToken
  players: PublicKey[];        // Vec<Pubkey>
  prizePool: bigint;           // u64
  isStarted: boolean;
  tokenMint?: PublicKey | null;
  // client-side helpers (not on-chain)
  status?: TournamentStatus;
  brackets?: TournamentRound[];
  winner?: TournamentPlayer | null;
}

// Betting strategies
export enum BettingStrategy {
  FIXED = 'fixed',
  MARTINGALE = 'martingale',
  DALEMBERT = "dalembert",
  FIBONACCI = "fibonacci"
}

// Fee settings
export interface FeeSettings {
  feePercentage: number; // 0.1% = 0.001
  rpsTokenFeeDiscount: number; // 50% discount = 0.5
}

// Currency benefits
export interface CurrencyBenefits {
  rpsTokenBonusPotPercentage: number; // 5% bonus = 0.05
}

// Player choice options
export enum Choice {
  None = 0,
  Rock = 1,
  Paper = 2,
  Scissors = 3
}

// Game outcome
export type GameOutcome = 'win' | 'loss' | 'tie';

// Game history item
export interface GameHistoryItem {
  playerChoice: number;
  opponentChoices: number[];
  result: GameOutcome;
  timestamp: number;
  wagerAmount: number;
}

// Auto-play statistics
export interface AutoPlayStats {
  currentStreak: number;
  wins: number;
  losses: number;
  ties: number;
  totalWagered: number;
  netProfit: number;
  gameHistory: GameHistoryItem[];
}

// Player data structure
export interface Player {
  pubkey: string;
  choice: number;
  committedChoice: number[];
  revealed: boolean;
  score: number;
}

// Game data structure
export interface Game {
  host: string;
  players: Player[];
  minPlayers: number;
  maxPlayers: number;
  state: number;
  currentRound: number;
  totalRounds: number;
  entryFee: number;
  gamePot: number;
  requiredTimeout: number;
  lastActionTimestamp: number;
  playerCount: number;
  losersCanRejoin: boolean;
  gameMode?: GameMode; // Optional for backward compatibility
  autoRoundDelay?: number; // Time between automated rounds in seconds
  maxAutoRounds?: number; // Maximum number of automated rounds
  currentAutoRound?: number; // Current auto round counter
  currencyMode?: CurrencyMode; // Which currency is being used
  tokenMint?: string; // Public key of token mint (if using RPSTOKEN)
  feeAccount?: string; // Public key of fee account
}

// Token balance
export interface TokenBalance {
  sol: number;
  rpsToken: number;
}

// Game data structure for UI
export interface GameData {
  escrowPubkey: PublicKey;
  playerOne: PublicKey;
  playerTwo: PublicKey | null;
  state: GameState;
  wager: number;
  timeoutStart: number | null;
  result: GameOutcome | null;
  playerOneChoice: number | null;
  playerTwoChoice: number | null;
}

// Player data structure - used for the UI
export interface PlayerInfo {
  publicKey: PublicKey;
  isCurrentUser: boolean;
  hasCommitted: boolean;
  choice: number | null;
}

// Game settings structure
export interface GameSettings {
  betAmount: number;
  currencyMode: CurrencyMode;
}

// Timer data for UI
export interface TimerData {
  isActive: boolean;
  startTime: number | null;
  duration: number;
}

// Game message for in-game chat or notifications
export interface GameMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

// Transaction notification data
export interface TransactionNotification {
  type: 'success' | 'error' | 'info';
  message: string;
  txId?: string;
  autoClose?: boolean;
  duration?: number;
}

// Export AppProps explicitly as needed
export type AppProps = unknown;
