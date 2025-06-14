import { Connection, PublicKey, ParsedInstruction, ParsedTransactionWithMeta, ConfirmedSignatureInfo } from '@solana/web3.js';
import client, { Gauge, Counter, Histogram, Registry } from 'prom-client';
import http from 'http';
import dotenv from 'dotenv';
import * as borsh from 'borsh';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config({ path: '../../.env' }); // Adjust path if your .env is elsewhere

// --- Configuration ---
const RPC_ENDPOINT = process.env.VITE_RPC_ENDPOINT || 'https://api.devnet.solana.com';
const PROGRAM_ID_STRING = process.env.VITE_RPS_PROGRAM_ID;
if (!PROGRAM_ID_STRING) {
  console.error('Error: VITE_RPS_PROGRAM_ID is not set in .env file.');
  process.exit(1);
}
const RPS_PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);
const METRICS_PORT = parseInt(process.env.MONITORING_METRICS_PORT || '9095', 10);
const POLLING_INTERVAL_MS = parseInt(process.env.MONITORING_POLLING_INTERVAL_MS || '30000', 10); // 30 seconds
const MAX_SIGNATURES_TO_FETCH = parseInt(process.env.MONITORING_MAX_SIGNATURES || '100', 10);

// Alerting thresholds (examples)
const TX_FAILURE_RATE_THRESHOLD = 0.1; // 10%
const STALLED_GAME_THRESHOLD_SECONDS = 300; // 5 minutes

// --- Borsh Schemas (mirroring lib.rs structs) ---

// Enums (numeric values as per lib.rs)
enum Choice { None, Rock, Paper, Scissors }
enum GameMode { Manual, Automated }
enum CurrencyMode { SOL, RPSToken }
enum GameStateEnum { WaitingForPlayers, CommitPhase, RevealPhase, Finished }

class Player {
  pubkey: Uint8Array; // 32 bytes
  choice: number; // u8
  committed_choice: Uint8Array; // 64 bytes
  salt: Uint8Array; // 32 bytes
  revealed: number; // bool as u8
  score: number; // u8

  constructor(fields: { pubkey: Uint8Array; choice: number; committed_choice: Uint8Array; salt: Uint8Array; revealed: number; score: number }) {
    this.pubkey = fields.pubkey;
    this.choice = fields.choice;
    this.committed_choice = fields.committed_choice;
    this.salt = fields.salt;
    this.revealed = fields.revealed;
    this.score = fields.score;
  }
}
const PlayerSchema = new Map([[Player, {
  kind: 'struct',
  fields: [
    ['pubkey', [32]],
    ['choice', 'u8'],
    ['committed_choice', [64]],
    ['salt', [32]],
    ['revealed', 'u8'], // bool is often u8 in Borsh
    ['score', 'u8'],
  ],
}]]);

class Game {
  host: Uint8Array; // Pubkey
  players: Player[]; // Vec<Player>
  min_players: number; // u8
  max_players: number; // u8
  state: number; // GameStateEnum as u8
  current_round: number; // u8
  total_rounds: number; // u8
  entry_fee: bigint; // u64
  game_pot: bigint; // u64
  required_timeout: bigint; // u64
  last_action_timestamp: bigint; // u64
  player_count: number; // u8
  losers_can_rejoin: number; // bool as u8
  game_mode: number; // GameMode as u8
  auto_round_delay: bigint; // u64
  max_auto_rounds: bigint; // u64
  current_auto_round: bigint; // u64
  currency_mode: number; // CurrencyMode as u8
  fee_collected: bigint; // u64
  token_mint: Uint8Array | null; // Option<Pubkey>

  constructor(fields: any) {
    this.host = fields.host;
    this.players = fields.players;
    this.min_players = fields.min_players;
    this.max_players = fields.max_players;
    this.state = fields.state;
    this.current_round = fields.current_round;
    this.total_rounds = fields.total_rounds;
    this.entry_fee = fields.entry_fee;
    this.game_pot = fields.game_pot;
    this.required_timeout = fields.required_timeout;
    this.last_action_timestamp = fields.last_action_timestamp;
    this.player_count = fields.player_count;
    this.losers_can_rejoin = fields.losers_can_rejoin;
    this.game_mode = fields.game_mode;
    this.auto_round_delay = fields.auto_round_delay;
    this.max_auto_rounds = fields.max_auto_rounds;
    this.current_auto_round = fields.current_auto_round;
    this.currency_mode = fields.currency_mode;
    this.fee_collected = fields.fee_collected;
    this.token_mint = fields.token_mint;
  }
}
const GameSchema = new Map([
  ...PlayerSchema,
  [Game, {
  kind: 'struct',
  fields: [
    ['host', [32]],
    ['players', [Player]], // Borsh handles Vec<Player> as [Player]
    ['min_players', 'u8'],
    ['max_players', 'u8'],
    ['state', 'u8'],
    ['current_round', 'u8'],
    ['total_rounds', 'u8'],
    ['entry_fee', 'u64'],
    ['game_pot', 'u64'],
    ['required_timeout', 'u64'],
    ['last_action_timestamp', 'u64'],
    ['player_count', 'u8'],
    ['losers_can_rejoin', 'u8'],
    ['game_mode', 'u8'],
    ['auto_round_delay', 'u64'],
    ['max_auto_rounds', 'u64'],
    ['current_auto_round', 'u64'],
    ['currency_mode', 'u8'],
    ['fee_collected', 'u64'],
    ['token_mint', { kind: 'option', type: [32] }], // Option<Pubkey>
  ],
}]]);

class TournamentState {
    host: Uint8Array; // Pubkey
    max_players: number; // u8
    entry_fee: bigint; // u64
    currency_mode: number; // CurrencyMode as u8
    players: Uint8Array[]; // Vec<Pubkey>
    prize_pool: bigint; // u64
    is_started: number; // bool as u8
    token_mint: Uint8Array | null; // Option<Pubkey>

    constructor(fields: any) {
        this.host = fields.host;
        this.max_players = fields.max_players;
        this.entry_fee = fields.entry_fee;
        this.currency_mode = fields.currency_mode;
        this.players = fields.players;
        this.prize_pool = fields.prize_pool;
        this.is_started = fields.is_started;
        this.token_mint = fields.token_mint;
    }
}
const TournamentStateSchema = new Map([[TournamentState, {
    kind: 'struct',
    fields: [
        ['host', [32]],
        ['max_players', 'u8'],
        ['entry_fee', 'u64'],
        ['currency_mode', 'u8'],
        ['players', [[32]]], // Vec<Pubkey>
        ['prize_pool', 'u64'],
        ['is_started', 'u8'], // bool as u8
        ['token_mint', { kind: 'option', type: [32] }],
    ],
}]]);


// --- Prometheus Metrics Setup ---
const register = new Registry();
client.collectDefaultMetrics({ register });

const commonLabels = ['program_id', 'network'];
const programIdLabel = { program_id: RPS_PROGRAM_ID.toBase58(), network: RPC_ENDPOINT.includes('devnet') ? 'devnet' : RPC_ENDPOINT.includes('mainnet') ? 'mainnet-beta' : 'localnet' };

// Game Metrics
const rpsGamesCreatedTotal = new Counter({ name: 'rps_games_created_total', help: 'Total number of RPS games created.', labelNames: commonLabels, registers: [register] });
const rpsGamesCompletedTotal = new Counter({ name: 'rps_games_completed_total', help: 'Total number of RPS games completed, by status.', labelNames: [...commonLabels, 'status'], registers: [register] });
const rpsGamesActiveGauge = new Gauge({ name: 'rps_games_active_gauge', help: 'Current number of active RPS games.', labelNames: commonLabels, registers: [register] });
const rpsGameDurationSecondsHistogram = new Histogram({ name: 'rps_game_duration_seconds_histogram', help: 'Histogram of game durations in seconds.', labelNames: commonLabels, buckets: [60, 120, 300, 600, 1800, 3600], registers: [register] });
const rpsGameEntryFeeHistogram = new Histogram({ name: 'rps_game_entry_fee_histogram', help: 'Histogram of game entry fees.', labelNames: [...commonLabels, 'currency'], registers: [register] });

// Transaction Metrics
const rpsProgramTransactionsProcessedTotal = new Counter({ name: 'rps_program_transactions_processed_total', help: 'Total number of transactions processed by the RPS program, by instruction type and status.', labelNames: [...commonLabels, 'instruction_type', 'status', 'error_code'], registers: [register] });

// Fee Metrics
const rpsFeesCollectedTotal = new Counter({ name: 'rps_fees_collected_total', help: 'Total amount of fees collected by the RPS program, by currency.', labelNames: [...commonLabels, 'currency'], registers: [register] });
const rpsFeeCollectionTransactionsTotal = new Counter({ name: 'rps_fee_collection_transactions_total', help: 'Total number of fee collection transactions.', labelNames: commonLabels, registers: [register] });

// Player Metrics
const rpsPlayerChoicesTotal = new Counter({ name: 'rps_player_choices_total', help: 'Total number of player choices made.', labelNames: [...commonLabels, 'choice'], registers: [register] });
const rpsActivePlayersGauge = new Gauge({ name: 'rps_active_players_gauge', help: 'Current number of players in active games.', labelNames: commonLabels, registers: [register] });

// Performance Metrics
const rpsInstructionProcessingDurationSecondsHistogram = new Histogram({ name: 'rps_instruction_processing_duration_seconds_histogram', help: 'Histogram of estimated instruction processing duration in seconds.', labelNames: [...commonLabels, 'instruction_type'], registers: [register] });

// Monitoring Service Health
const rpsMonitoringServiceUpGauge = new Gauge({ name: 'rps_monitoring_service_up_gauge', help: 'Indicates if the monitoring service is up and running (1 for up, 0 for down).', labelNames: commonLabels, registers: [register] });
const rpsMonitoringLastPollTimestampGauge = new Gauge({ name: 'rps_monitoring_last_poll_timestamp_gauge', help: 'Timestamp of the last successful data poll.', labelNames: commonLabels, registers: [register] });
const rpsMonitoringPollDurationSecondsHistogram = new Histogram({ name: 'rps_monitoring_poll_duration_seconds_histogram', help: 'Histogram of monitoring poll durations.', labelNames: commonLabels, registers: [register] });

// Security-specific metrics
const rpsDeserialisationFailuresTotal = new Counter({ name: 'rps_deserialisation_failures_total', help: 'Total number of game-account deserialisation failures.', labelNames: [...commonLabels, 'account_type'], registers: [register] });
const rpsUnknownInstructionsTotal = new Counter({ name: 'rps_unknown_instructions_total', help: 'Number of transactions whose first byte did not map to a known RPS instruction.', labelNames: commonLabels, registers: [register] });

// Tournament Metrics
const rpsTournamentsCreatedTotal = new Counter({ name: 'rps_tournaments_created_total', help: 'Total number of RPS tournaments created.', labelNames: commonLabels, registers: [register] });
const rpsTournamentsActiveGauge = new Gauge({ name: 'rps_tournaments_active_gauge', help: 'Current number of active RPS tournaments.', labelNames: commonLabels, registers: [register] });
const rpsTournamentPlayersJoinedTotal = new Counter({ name: 'rps_tournament_players_joined_total', help: 'Total number of players joining tournaments.', labelNames: commonLabels, registers: [register] });
const rpsTournamentEntryFeeHistogram = new Histogram({ name: 'rps_tournament_entry_fee_histogram', help: 'Histogram of tournament entry fees.', labelNames: [...commonLabels, 'currency'], registers: [register] });
const rpsTournamentActivePrizePoolGauge = new Gauge({ name: 'rps_tournament_active_prize_pool_gauge', help: 'Total prize pool in active tournaments, by currency.', labelNames: [...commonLabels, 'currency'], registers: [register] });


// --- Solana Connection and Data Fetching ---
const connection = new Connection(RPC_ENDPOINT, 'confirmed');
let lastProcessedSignature: string | undefined = undefined;


function deserializeGameState(data: Buffer): Game | null {
  try {
    return borsh.deserialize(GameSchema, Game, data);
  } catch (error) {
    console.error('Error deserializing Game state:', error);
    rpsDeserialisationFailuresTotal.inc({ ...programIdLabel, account_type: 'Game' });
    return null;
  }
}

function deserializeTournamentState(data: Buffer): TournamentState | null {
    try {
        return borsh.deserialize(TournamentStateSchema, TournamentState, data);
    } catch (error) {
        console.error('Error deserializing TournamentState:', error);
        rpsDeserialisationFailuresTotal.inc({ ...programIdLabel, account_type: 'TournamentState' });
        return null;
    }
}

async function fetchAndProcessGameAccounts() {
  console.log('Fetching program accounts...');
  try {
    const allProgramAccounts = await connection.getProgramAccounts(RPS_PROGRAM_ID);
    
    let activeGamesCount = 0;
    let currentActivePlayersInGames = 0;
    let activeTournamentsCount = 0;
    let totalTournamentPrizePoolSOL = 0;
    let totalTournamentPrizePoolToken = 0;

    for (const account of allProgramAccounts) {
      // Try deserializing as Game first
      const gameState = deserializeGameState(account.account.data);
      if (gameState) {
        if (gameState.state !== GameStateEnum.Finished) { // Assuming GameStateEnum.Finished is 3
            activeGamesCount++;
            currentActivePlayersInGames += gameState.players.length;
        }
        const currencyLabel = gameState.currency_mode === CurrencyMode.SOL ? 'SOL' : 'RPSToken';
        rpsGameEntryFeeHistogram.observe({ ...programIdLabel, currency: currencyLabel }, Number(gameState.entry_fee));
        // Add other game-specific metrics updates here
        continue; // Successfully deserialized as Game, move to next account
      }

      // If not Game, try deserializing as TournamentState
      const tournamentState = deserializeTournamentState(account.account.data);
      if (tournamentState) {
        if (tournamentState.is_started === 0) { // Assuming 0 for false (not started yet)
            activeTournamentsCount++; // Or count based on a "finished" flag if added later
        }
        const currencyLabel = tournamentState.currency_mode === CurrencyMode.SOL ? 'SOL' : 'RPSToken';
        rpsTournamentEntryFeeHistogram.observe({ ...programIdLabel, currency: currencyLabel }, Number(tournamentState.entry_fee));
        if (tournamentState.currency_mode === CurrencyMode.SOL) {
            totalTournamentPrizePoolSOL += Number(tournamentState.prize_pool);
        } else {
            totalTournamentPrizePoolToken += Number(tournamentState.prize_pool);
        }
        // Add other tournament-specific metrics updates here
      }
    }
    rpsGamesActiveGauge.set(programIdLabel, activeGamesCount);
    rpsActivePlayersGauge.set(programIdLabel, currentActivePlayersInGames);
    rpsTournamentsActiveGauge.set(programIdLabel, activeTournamentsCount);
    rpsTournamentActivePrizePoolGauge.set({ ...programIdLabel, currency: 'SOL' }, totalTournamentPrizePoolSOL);
    rpsTournamentActivePrizePoolGauge.set({ ...programIdLabel, currency: 'RPSToken' }, totalTournamentPrizePoolToken);

    console.log(`Found ${allProgramAccounts.length} total accounts. Active Games: ${activeGamesCount}, Active Tournaments: ${activeTournamentsCount}.`);
  } catch (error) {
    console.error('Error fetching or processing program accounts:', error);
    rpsMonitoringServiceUpGauge.set(programIdLabel, 0);
  }
}

function getProgramInstruction(tx: ParsedTransactionWithMeta): ParsedInstruction | null {
  const ix = tx.transaction.message.instructions.find(
    (i) => 'programId' in i && (i as ParsedInstruction).programId.toString() === RPS_PROGRAM_ID.toBase58()
  );
  return ix as ParsedInstruction | null;
}

function parseInstructionType(transaction: ParsedTransactionWithMeta): string {
  const ix = getProgramInstruction(transaction);
  if (!ix || !('data' in ix)) {
    rpsUnknownInstructionsTotal.inc(programIdLabel);
    return 'unknown_instruction';
  }
  const raw = Buffer.from(ix.data as string, 'base64');
  if (raw.length === 0) { // Handle empty data case
    rpsUnknownInstructionsTotal.inc(programIdLabel);
    return 'unknown_instruction_empty_data';
  }
  const disc = raw[0];
  switch (disc) {
    case 0: return 'InitializeGame';
    case 1: return 'JoinGame';
    case 2: return 'CommitChoice';
    case 3: return 'RevealChoice';
    case 4: return 'ResolveTimeout';
    case 5: return 'ClaimWinnings';
    case 6: return 'RejoinGame';
    case 7: return 'StartNewGameRound';
    case 8: return 'AutoPlayNextRound';
    case 9: return 'AddBotPlayers';
    case 10: return 'CollectFees';
    case 11: return 'CreateTournament';
    case 12: return 'JoinTournament';
    default:
      rpsUnknownInstructionsTotal.inc(programIdLabel);
      return `unknown_disc_${disc}`;
  }
}

function parsePlayerChoiceFromInstruction(transaction: ParsedTransactionWithMeta): string | null {
    const ix = getProgramInstruction(transaction);
    if (ix && ix.data) {
        const raw = Buffer.from(ix.data as string, 'base64');
        if (raw.length > 1 && raw[0] === 3) { // RevealChoice instruction
            const choiceEnumVal = raw[1]; // Assuming choice is the second byte after discriminator
            switch (choiceEnumVal) {
                case Choice.Rock: return 'Rock';
                case Choice.Paper: return 'Paper';
                case Choice.Scissors: return 'Scissors';
                default: return 'None';
            }
        }
    }
    return null;
}

function parseFeeCollectedFromTransaction(transaction: ParsedTransactionWithMeta): { amount: number, currency: 'SOL' | 'RPSToken' } | null {
    // This is complex as it requires parsing logs or pre/post balances.
    // For simplicity, we might rely on game account polling for fee_collected field changes.
    // If CollectFees instruction logs the amount and currency, parse logs here.
    // Example log: "Collected 1000000 lamports as fees"
    if (tx.meta?.logMessages) {
        for (const logMsg of tx.meta.logMessages) {
            if (logMsg.includes("Collected") && logMsg.includes("fees")) {
                const match = logMsg.match(/Collected (\d+) (lamports|tokens)/); // Adjust regex
                if (match && match[1] && match[2]) {
                    const amount = parseInt(match[1], 10);
                    const currency = match[2] === 'lamports' ? 'SOL' : 'RPSToken';
                    return { amount, currency };
                }
            }
        }
    }
    return null;
}

let tx: ParsedTransactionWithMeta; // Define tx here to be accessible in the scope

async function fetchAndProcessTransactionLogs() {
  console.log('Fetching transaction logs...');
  try {
    const signaturesInfos: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
      RPS_PROGRAM_ID,
      { limit: MAX_SIGNATURES_TO_FETCH, until: lastProcessedSignature },
      'confirmed'
    );

    if (signaturesInfos.length === 0) {
      console.log('No new transactions found.');
      return;
    }

    const newSignatures = signaturesInfos.map(s => s.signature).reverse(); // Process oldest new first
    
    const transactions = await connection.getParsedTransactions(newSignatures, { maxSupportedTransactionVersion: 0 });

    for (const currentTx of transactions) { // Renamed to currentTx to avoid conflict
      if (!currentTx) continue;
      tx = currentTx; // Assign to the outer scope tx for use in helper functions if needed, though direct passing is better

      const instructionType = parseInstructionType(tx);
      const status = tx.meta?.err ? 'failure' : 'success';
      const errorCode = tx.meta?.err ? JSON.stringify(tx.meta.err) : 'none';

      rpsProgramTransactionsProcessedTotal.inc({ ...programIdLabel, instruction_type: instructionType, status, error_code: errorCode });

      if (status === 'success') {
        if (instructionType === 'InitializeGame') {
          rpsGamesCreatedTotal.inc(programIdLabel);
        }
        if (instructionType === 'CreateTournament') {
            rpsTournamentsCreatedTotal.inc(programIdLabel);
            // Entry fee for histogram could be parsed from instruction data if needed,
            // but it's also captured from account data polling.
        }
        if (instructionType === 'JoinTournament') {
            rpsTournamentPlayersJoinedTotal.inc(programIdLabel);
        }
        const choice = parsePlayerChoiceFromInstruction(tx);
        if (choice) {
          rpsPlayerChoicesTotal.inc({ ...programIdLabel, choice });
        }
        const feeInfo = parseFeeCollectedFromTransaction(tx);
        if (feeInfo) {
            rpsFeesCollectedTotal.inc({ ...programIdLabel, currency: feeInfo.currency }, feeInfo.amount);
            rpsFeeCollectionTransactionsTotal.inc(programIdLabel);
        }
      }
    }

    if (newSignatures.length > 0) {
      lastProcessedSignature = newSignatures[newSignatures.length - 1];
      console.log(`Processed ${newSignatures.length} new transactions. Last signature: ${lastProcessedSignature}`);
    }
  } catch (error) {
    console.error('Error fetching or processing transaction logs:', error);
    rpsMonitoringServiceUpGauge.set(programIdLabel, 0);
  }
}

function checkAlerts() {
  console.log('Checking alerts...');
  const metrics = rpsProgramTransactionsProcessedTotal.get();
  if (!metrics || !metrics.values) return;

  const totalFailures = metrics.values.filter(v => v.labels.status === 'failure').reduce((sum, v) => sum + v.value, 0);
  const totalSuccesses = metrics.values.filter(v => v.labels.status === 'success').reduce((sum, v) => sum + v.value, 0);
  const totalProcessed = totalFailures + totalSuccesses;

  if (totalProcessed > 50 && (totalFailures / totalProcessed) > TX_FAILURE_RATE_THRESHOLD) {
    triggerAlert('HighTransactionFailureRate', `Failure rate ${((totalFailures / totalProcessed) * 100).toFixed(2)}% exceeds threshold.`);
  }
}

function triggerAlert(alertName: string, message: string, severity: 'critical' | 'warning' = 'warning') {
  console.warn(`ALERT [${severity.toUpperCase()}] (${alertName}): ${message}`);
  if (process.env.SLACK_WEBHOOK_URL) {
    fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*${severity.toUpperCase()}* ${alertName}: ${message}` }),
    }).catch((err) => console.error('Slack alert failed:', err));
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

async function mainLoop() {
  const pollStartTime = Date.now();
  rpsMonitoringServiceUpGauge.set(programIdLabel, 1);

  await fetchAndProcessGameAccounts();
  await fetchAndProcessTransactionLogs();
  checkAlerts();

  rpsMonitoringLastPollTimestampGauge.set(programIdLabel, Date.now() / 1000);
  const pollDurationSeconds = (Date.now() - pollStartTime) / 1000;
  rpsMonitoringPollDurationSecondsHistogram.observe(programIdLabel, pollDurationSeconds);
  console.log(`Polling loop completed in ${pollDurationSeconds.toFixed(2)}s.`);
}

async function startService() {
  console.log(`Solana RPS Monitoring Service starting...`);
  console.log(`Connecting to RPC: ${RPC_ENDPOINT}`);
  console.log(`Monitoring Program ID: ${RPS_PROGRAM_ID.toBase58()}`);

  await mainLoop();
  setInterval(mainLoop, POLLING_INTERVAL_MS);

  server.listen(METRICS_PORT, () => {
    console.log(`Prometheus metrics server listening on http://localhost:${METRICS_PORT}/metrics`);
  });

  process.on('SIGINT', () => {
    console.log('Shutting down monitoring service...');
    rpsMonitoringServiceUpGauge.set(programIdLabel, 0);
    server.close(() => {
      console.log('Metrics server closed.');
      process.exit(0);
    });
  });
}

startService().catch(error => {
  console.error('Failed to start monitoring service:', error);
  rpsMonitoringServiceUpGauge.set(programIdLabel, 0);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  rpsMonitoringServiceUpGauge.set(programIdLabel, 0);
  process.exit(1);
});

// Ensure Buffer is globally available if not already (e.g. in some Node.js versions or environments)
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
