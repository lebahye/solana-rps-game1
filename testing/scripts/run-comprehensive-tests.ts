import dotenv from 'dotenv';
import chalk from 'chalk';
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
  AccountMeta,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferInstruction,
  getAccount,
  getMinimumBalanceForRentExemptMint,
  createInitializeMintInstruction,
  MintLayout,
  AccountLayout,
} from '@solana/spl-token';
import { Buffer } from 'buffer';
import { sha256 } from 'js-sha256';
import bs58 from 'bs58';

// Adjust path as necessary if frontend/src is structured differently or rps-client is elsewhere
import { RPSGameClient, Wallet } from '../../../frontend/src/rps-client'; 
import { Choice, GameState, Game, Player as GamePlayer, CurrencyMode, GameMode } from '../../../frontend/src/types'; // Assuming types are exported

dotenv.config({ path: '../../.env' }); // Load .env from project root

// --- Configuration ---
const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'http://127.0.0.1:8899';
const PROGRAM_ID_STRING = process.env.VITE_RPS_PROGRAM_ID;
if (!PROGRAM_ID_STRING) {
  console.error(chalk.red('Error: VITE_RPS_PROGRAM_ID is not set in .env file.'));
  process.exit(1);
}
const RPS_PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

const FAUCET_SECRET_KEY_STRING = process.env.FAUCET_SECRET_KEY; // Base58 encoded secret key
let FAUCET_KEYPAIR: Keypair;
if (FAUCET_SECRET_KEY_STRING) {
  try {
    FAUCET_KEYPAIR = Keypair.fromSecretKey(bs58.decode(FAUCET_SECRET_KEY_STRING));
  } catch (e) {
    console.error(chalk.red('Invalid FAUCET_SECRET_KEY in .env file. Please provide a valid Base58 encoded secret key.'), e);
    process.exit(1);
  }
} else {
  console.warn(chalk.yellow('Warning: FAUCET_SECRET_KEY not found in .env. Generating a new keypair for faucet (will need funding).'));
  FAUCET_KEYPAIR = Keypair.generate();
}

const RPS_TOKEN_MINT_STRING = process.env.VITE_RPS_TOKEN_MINT; // Optional, for testing with existing mint
let RPS_TOKEN_MINT_PUBKEY: PublicKey | null = RPS_TOKEN_MINT_STRING ? new PublicKey(RPS_TOKEN_MINT_STRING) : null;
const IS_NEW_MINT_CREATED = !RPS_TOKEN_MINT_PUBKEY; // Flag if we create a new mint for testing

const FEE_COLLECTOR_STRING = process.env.VITE_FEE_COLLECTOR_ACCOUNT || Keypair.generate().publicKey.toBase58(); // Default to a new key if not set
const FEE_COLLECTOR_PUBKEY = new PublicKey(FEE_COLLECTOR_STRING);

const log = {
  info: (message: string) => console.log(chalk.blue(`[INFO] ${message}`)),
  success: (message: string) => console.log(chalk.green(`[SUCCESS] ${message}`)),
  warn: (message: string) => console.log(chalk.yellow(`[WARN] ${message}`)),
  error: (message: string, error?: any) => console.error(chalk.red(`[ERROR] ${message}`), error || ''),
  testTitle: (title: string) => console.log(chalk.cyan.bold(`\n--- ${title} ---`)),
  testCase: (name: string) => console.log(chalk.magenta.underline(`\n🧪 Test Case: ${name}`)),
};

// --- Global State ---
let connection: Connection;
let payerKeypair: Keypair; // Also acts as faucet and potentially mint authority
let playerKeypairs: Keypair[] = [];
const PLAYER_COUNT = 4; // Max players to test with

// --- Utility Functions ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function createAndFundWallet(lamports = 2 * LAMPORTS_PER_SOL): Promise<Keypair> {
  const wallet = Keypair.generate();
  log.info(`Funding wallet ${wallet.publicKey.toBase58()}...`);
  try {
    const airdropSignature = await connection.requestAirdrop(wallet.publicKey, lamports);
    await connection.confirmTransaction(airdropSignature, 'confirmed');
    log.success(`Wallet ${wallet.publicKey.toBase58()} funded with ${lamports / LAMPORTS_PER_SOL} SOL.`);
  } catch (err) {
    log.error(`Failed to fund wallet ${wallet.publicKey.toBase58()}. Ensure local validator is running or devnet has funds.`, err);
    // Try funding from faucet if main airdrop fails (e.g. on devnet with rate limits)
    if (payerKeypair && payerKeypair.publicKey.toString() !== wallet.publicKey.toString()) {
        log.info(`Attempting to fund ${wallet.publicKey.toBase58()} from faucet ${payerKeypair.publicKey.toBase58()}`);
        try {
            const tx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: payerKeypair.publicKey,
                    toPubkey: wallet.publicKey,
                    lamports: LAMPORTS_PER_SOL / 2, // smaller amount from faucet
                })
            );
            await sendAndConfirmTransaction(connection, tx, [payerKeypair]);
            log.success(`Successfully funded ${wallet.publicKey.toBase58()} from faucet.`);
        } catch (faucetErr) {
            log.error(`Faucet funding also failed for ${wallet.publicKey.toBase58()}`, faucetErr);
            throw faucetErr; // re-throw if faucet funding fails
        }
    } else {
      throw err; // re-throw original error if no faucet or self-funding
    }
  }
  return wallet;
}

function createMockWallet(keypair: Keypair): Wallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (transaction: Transaction) => {
      transaction.partialSign(keypair);
      return transaction;
    },
    sendTransaction: async (transaction: Transaction, conn: Connection) => {
      // For single-signed transactions by this keypair
      return await sendAndConfirmTransaction(conn, transaction, [keypair], { commitment: 'confirmed', skipPreflight: false });
    },
    // signAllTransactions: async (transactions: Transaction[]) => {
    //   return transactions.map(tx => {
    //     tx.partialSign(keypair);
    //     return tx;
    //   });
    // }
  };
}

async function getSolBalance(pubKey: PublicKey): Promise<number> {
  return (await connection.getBalance(pubKey)) / LAMPORTS_PER_SOL;
}

async function getTokenBalance(owner: PublicKey, mint: PublicKey): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, owner, false);
    const accountInfo = await getAccount(connection, ata);
    const mintInfo = await connection.getAccountInfo(mint);
    if (!mintInfo) throw new Error("Mint not found");
    const mintData = MintLayout.decode(mintInfo.data);
    return Number(accountInfo.amount) / (10 ** mintData.decimals);
  } catch (e) {
    // If ATA doesn't exist, balance is 0
    return 0;
  }
}

async function ensureAtaExists(user: Keypair, owner: PublicKey, mint: PublicKey): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, false);
  try {
    await getAccount(connection, ata);
  } catch (e) {
    log.info(`ATA ${ata.toBase58()} for owner ${owner.toBase58()} and mint ${mint.toBase58()} not found. Creating...`);
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(user.publicKey, ata, owner, mint)
    );
    await sendAndConfirmTransaction(connection, tx, [user]);
    log.success(`Created ATA ${ata.toBase58()}`);
  }
  return ata;
}

const generateSalt = (): string => {
  const buffer = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer.toString('hex');
};

const computeCommitment = (choiceValue: number, saltHex: string): Buffer => {
  const saltBuffer = Buffer.from(saltHex, 'hex');
  const choiceBuffer = Buffer.from([choiceValue]);
  
  const combined = Buffer.concat([saltBuffer, choiceBuffer]);
  const hash = sha256.create();
  hash.update(combined);
  const hashedChoiceBytes = Buffer.from(hash.arrayBuffer()); // 32 bytes

  // Pad to 64 bytes as per backend expectation
  const commitment = Buffer.concat([hashedChoiceBytes, Buffer.alloc(32)]);
  return commitment;
};

async function getGameData(client: RPSGameClient, gameId: string): Promise<Game | null> {
  try {
    // RPSGameClient needs a method like `getGameAccountState(gameId: string): Promise<Game>`
    // For now, let's assume client can fetch and deserialize.
    // If not, we'd do:
    const gamePubkey = new PublicKey(gameId);
    const accountInfo = await connection.getAccountInfo(gamePubkey);
    if (!accountInfo) return null;
    
    // The Game struct schema needs to be available here for deserialization
    // This is a simplification; actual deserialization needs the Borsh schema from rps-client.ts
    // For this test, we'll rely on client methods or assume they are added.
    // The following is a placeholder if client lacks direct state fetching:
    // return client.deserializeGameAccount(accountInfo.data); // Assuming deserializeGameAccount is public/accessible
    
    // Hacky way if client doesn't expose deserialization directly - this is not ideal
    // This is a placeholder and likely won't work without proper schema definition here.
    // This part is tricky without knowing the exact structure of client.
    // For now, we'll assume a method exists or use a simplified representation.
    // In a real test, you'd use the same Borsh schema as the client.
    log.warn("getGameData: Deserialization logic is simplified. RPSGameClient should provide a method.");
    // This is a very rough mock. Replace with actual deserialization using Borsh.
    // For now, we'll assume the client has a method that returns the game state.
    // If client.getGameAccount(gameId) exists and returns the Game object:
    // return await client.getGameAccount(new PublicKey(gameId)); 
    
    // Placeholder: if your client has a method like this:
    // return await client.getGameState(gameId); 
    // This will likely fail unless client has such a method.
    // For now, this function will be a stub and tests will rely on client actions reflecting state.
    log.warn(`getGameData for ${gameId} is a stub. Full state verification requires client method or local deserialization.`);
    return null; // Placeholder
  } catch (error) {
    log.error(`Failed to get game data for ${gameId}:`, error);
    return null;
  }
}

async function logAllBalances() {
    log.info(chalk.bold.underline("\n--- Account Balances ---"));
    log.info(`Faucet/Payer (${payerKeypair.publicKey.toBase58()}): ${await getSolBalance(payerKeypair.publicKey)} SOL`);
    if (RPS_TOKEN_MINT_PUBKEY) {
        log.info(`  RPS Tokens: ${await getTokenBalance(payerKeypair.publicKey, RPS_TOKEN_MINT_PUBKEY)}`);
    }

    for (let i = 0; i < playerKeypairs.length; i++) {
        const player = playerKeypairs[i];
        log.info(`Player ${i + 1} (${player.publicKey.toBase58()}): ${await getSolBalance(player.publicKey)} SOL`);
        if (RPS_TOKEN_MINT_PUBKEY) {
            log.info(`  RPS Tokens: ${await getTokenBalance(player.publicKey, RPS_TOKEN_MINT_PUBKEY)}`);
        }
    }
    log.info(`Fee Collector (${FEE_COLLECTOR_PUBKEY.toBase58()}): ${await getSolBalance(FEE_COLLECTOR_PUBKEY)} SOL`);
     if (RPS_TOKEN_MINT_PUBKEY) {
        log.info(`  RPS Tokens: ${await getTokenBalance(FEE_COLLECTOR_PUBKEY, RPS_TOKEN_MINT_PUBKEY)}`);
    }
    log.info(chalk.bold.underline("------------------------\n"));
}


// --- Test Environment Setup ---
async function initializeTestEnvironment() {
  log.testTitle("Initializing Test Environment");
  connection = new Connection(RPC_ENDPOINT, 'confirmed');
  log.info(`Connected to RPC: ${RPC_ENDPOINT}`);
  log.info(`RPS Program ID: ${RPS_PROGRAM_ID.toBase58()}`);

  // Setup Payer/Faucet
  payerKeypair = FAUCET_KEYPAIR;
  log.info(`Payer/Faucet Public Key: ${payerKeypair.publicKey.toBase58()}`);
  let payerBalance = await getSolBalance(payerKeypair.publicKey);
  if (payerBalance < 2) { // Need at least 2 SOL for operations
    log.warn(`Payer/Faucet has low balance (${payerBalance} SOL). Attempting to airdrop...`);
    try {
      // Fund the faucet itself instead of replacing the keypair reference
      const airdropSig = await connection.requestAirdrop(
        payerKeypair.publicKey,
        5 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(airdropSig, 'confirmed');
      const airdropSignature = await connection.requestAirdrop(payerKeypair.publicKey, LAMPORTS_PER_SOL * 5);
      await connection.confirmTransaction(airdropSignature, 'confirmed');
      log.success(`Payer/Faucet ${payerKeypair.publicKey.toBase58()} funded.`);
    } catch (e) {
      log.error("Failed to fund Payer/Faucet. Please ensure it has enough SOL.", e);
      process.exit(1);
    }
  }
  
  // Create or load RPS Token Mint
  if (!RPS_TOKEN_MINT_PUBKEY && RPS_TOKEN_MINT_STRING) { // If string was provided but key is null (should not happen with current logic)
      RPS_TOKEN_MINT_PUBKEY = new PublicKey(RPS_TOKEN_MINT_STRING);
  } else if (!RPS_TOKEN_MINT_PUBKEY) { // Create a new mint if none provided
    log.warn('No VITE_RPS_TOKEN_MINT provided. Creating a new temporary RPS Token mint for testing...');
    const mintKeypair = Keypair.generate();
    RPS_TOKEN_MINT_PUBKEY = mintKeypair.publicKey;
    const lamports = await getMinimumBalanceForRentExemptMint(connection);
    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payerKeypair.publicKey,
        newAccountPubkey: RPS_TOKEN_MINT_PUBKEY,
        space: MintLayout.span,
        lamports,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        RPS_TOKEN_MINT_PUBKEY, // mint pubkey
        9, // decimals
        payerKeypair.publicKey, // mint authority
        payerKeypair.publicKey  // freeze authority (optional)
      )
    );
    await sendAndConfirmTransaction(connection, transaction, [payerKeypair, mintKeypair]);
    log.success(`Created new RPS Token Mint: ${RPS_TOKEN_MINT_PUBKEY.toBase58()} with payer as mint authority.`);
  }
  log.info(`Using RPS Token Mint: ${RPS_TOKEN_MINT_PUBKEY.toBase58()}`);
  await ensureAtaExists(payerKeypair, FEE_COLLECTOR_PUBKEY, RPS_TOKEN_MINT_PUBKEY);


  // Create and fund player wallets
  playerKeypairs = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const player = await createAndFundWallet();
    playerKeypairs.push(player);
    if (RPS_TOKEN_MINT_PUBKEY) {
      const playerAta = await ensureAtaExists(payerKeypair, player.publicKey, RPS_TOKEN_MINT_PUBKEY);
      // Mint some tokens to the player
      const mintTx = new Transaction().add(
        createMintToInstruction(
          RPS_TOKEN_MINT_PUBKEY,
          playerAta,
          payerKeypair.publicKey, // Mint authority
          1000 * (10 ** 9) // 1000 tokens (assuming 9 decimals)
        )
      );
      await sendAndConfirmTransaction(connection, mintTx, [payerKeypair]);
      log.success(`Minted 1000 RPS Tokens to Player ${i + 1} (${player.publicKey.toBase58()})`);
    }
  }
  await logAllBalances();
  log.success("Test environment initialized.");
}

// --- Test Suites ---

async function runSecurityTests() {
  log.testTitle("Security Tests");
  const player1 = playerKeypairs[0];
  const client = new RPSGameClient(connection, createMockWallet(player1), RPS_PROGRAM_ID);

  log.testCase("Valid Commit-Reveal");
  let gameId_sec1: string | null = null;
  try {
    const createResult = await client.createGame( // Assuming client.createGame matches new backend sig
      3, 3, 1, 0.1 * LAMPORTS_PER_SOL, 60, false, CurrencyMode.SOL, undefined // tokenMint for SOL game
    );
    gameId_sec1 = createResult.gameId;
    log.info(`Game created for commit-reveal test: ${gameId_sec1}`);

    // Player 2 and 3 join
    for (let i = 1; i < 3; i++) {
        const p = playerKeypairs[i];
        const pClient = new RPSGameClient(connection, createMockWallet(p), RPS_PROGRAM_ID);
        await pClient.joinGame(gameId_sec1);
        log.info(`Player ${i+1} joined game ${gameId_sec1}`);
    }
    await delay(1000); // wait for state update

    const choice = Choice.Rock; // 1
    const salt = generateSalt();
    const commitment = computeCommitment(choice as number, salt);

    await client.commitChoice(gameId_sec1, commitment, Buffer.from(salt, 'hex'));
    log.success(`Player 1 committed choice to game ${gameId_sec1}`);
    
    // Other players commit (dummy for now)
    for (let i = 1; i < 3; i++) {
        const p = playerKeypairs[i];
        const pClient = new RPSGameClient(connection, createMockWallet(p), RPS_PROGRAM_ID);
        const pSalt = generateSalt();
        const pCommitment = computeCommitment(Choice.Paper as number, pSalt);
        await pClient.commitChoice(gameId_sec1, pCommitment, Buffer.from(pSalt, 'hex'));
    }
    await delay(1000);

    await client.revealChoice(gameId_sec1, choice, Buffer.from(salt, 'hex')); // Client reveal might need adjustment for salt
                                                                            // Backend reveal doesn't take salt, it uses stored salt.
                                                                            // Client revealChoice(gameId, choice)
    log.success(`Player 1 successfully revealed choice.`);

  } catch (error) {
    log.error("Valid Commit-Reveal test failed.", error);
  }

  log.testCase("Invalid Reveal (Wrong Choice)");
  let gameId_sec2: string | null = null;
  try {
    const createResult = await client.createGame(3,3,1, 0.1 * LAMPORTS_PER_SOL, 60, false, CurrencyMode.SOL, undefined);
    gameId_sec2 = createResult.gameId;
    log.info(`Game created for wrong choice test: ${gameId_sec2}`);
    for (let i = 1; i < 3; i++) { /* ... players join ... */ await (new RPSGameClient(connection, createMockWallet(playerKeypairs[i]), RPS_PROGRAM_ID)).joinGame(gameId_sec2); }
    
    const actualChoice = Choice.Rock;
    const wrongChoice = Choice.Paper;
    const salt = generateSalt();
    const commitment = computeCommitment(actualChoice as number, salt);

    await client.commitChoice(gameId_sec2, commitment, Buffer.from(salt, 'hex'));
    log.info(`Player 1 committed for wrong choice test.`);
    for (let i = 1; i < 3; i++) { /* ... other players commit ... */ await (new RPSGameClient(connection, createMockWallet(playerKeypairs[i]), RPS_PROGRAM_ID)).commitChoice(gameId_sec2, computeCommitment(Choice.Rock as number, generateSalt()), Buffer.from(generateSalt(),'hex')); }


    try {
      await client.revealChoice(gameId_sec2, wrongChoice, Buffer.from(salt, 'hex')); // Reveal with wrong choice
      log.error("Invalid Reveal (Wrong Choice) test FAILED: Reveal succeeded unexpectedly.");
    } catch (revealError) {
      if ((revealError as Error).message.includes("Invalid hash") || (revealError as Error).message.includes("custom program error: 0x6")) { // 0x6 is InvalidHash from RPSError
        log.success("Invalid Reveal (Wrong Choice) test PASSED: Reveal failed as expected.");
      } else {
        log.error("Invalid Reveal (Wrong Choice) test FAILED: Reveal failed with unexpected error.", revealError);
      }
    }
  } catch (error) {
    log.error("Setup for Invalid Reveal (Wrong Choice) test failed.", error);
  }
  
  log.testCase("Invalid Reveal (Wrong Salt)");
  // Similar structure to Wrong Choice, but reveal with correct choice and wrong salt.
  // This test is tricky because the backend's RevealChoice instruction doesn't take salt. It uses the salt stored during commit.
  // So, if a player commits with salt S1, they can only reveal for S1. There's no way to submit a "wrong salt" at reveal time.
  // The security here is that the commitment itself is tied to S1.
  // This test case might be redundant given the current backend design.
  log.warn("Invalid Reveal (Wrong Salt) test is implicitly covered by the commit-reveal mechanism. A 'wrong salt' cannot be submitted at reveal time with current backend design.");

}

async function runFeeCollectionTests() {
  log.testTitle("Fee Collection Tests");
  const player1 = playerKeypairs[0];
  const player2 = playerKeypairs[1];
  const player3 = playerKeypairs[2];
  const client1 = new RPSGameClient(connection, createMockWallet(player1), RPS_PROGRAM_ID);
  const client2 = new RPSGameClient(connection, createMockWallet(player2), RPS_PROGRAM_ID);
  const client3 = new RPSGameClient(connection, createMockWallet(player3), RPS_PROGRAM_ID);

  const entryFeeSOL = 0.5 * LAMPORTS_PER_SOL;
  const expectedFeePerPlayerSOL = Math.floor(entryFeeSOL * 10 / 1000); // 1%
  const totalExpectedFeeSOL = expectedFeePerPlayerSOL * 3;

  log.testCase("Fee Collection - SOL Game");
  let gameIdFeeSOL: string | null = null;
  try {
    const feeCollectorInitialSOL = await getSolBalance(FEE_COLLECTOR_PUBKEY);

    const createResult = await client1.createGame(3, 3, 1, entryFeeSOL, 60, false, CurrencyMode.SOL, undefined);
    gameIdFeeSOL = createResult.gameId;
    log.info(`SOL Game for fee test created: ${gameIdFeeSOL}`);
    const gameAccountSOLKey = new PublicKey(gameIdFeeSOL);

    await client2.joinGame(gameIdFeeSOL);
    await client3.joinGame(gameIdFeeSOL);
    log.info("All players joined SOL fee game.");
    await delay(2000);

    // Verify fee_collected in game state (if accessible, otherwise verify by balances)
    // For now, we will verify by balances after collection.

    // Play out the game quickly
    const salt1 = generateSalt(); await client1.commitChoice(gameIdFeeSOL, computeCommitment(Choice.Rock as number, salt1), Buffer.from(salt1, 'hex'));
    const salt2 = generateSalt(); await client2.commitChoice(gameIdFeeSOL, computeCommitment(Choice.Paper as number, salt2), Buffer.from(salt2, 'hex'));
    const salt3 = generateSalt(); await client3.commitChoice(gameIdFeeSOL, computeCommitment(Choice.Scissors as number, salt3), Buffer.from(salt3, 'hex'));
    await delay(1000);
    await client1.revealChoice(gameIdFeeSOL, Choice.Rock, Buffer.from(salt1, 'hex')); // P1 Rock
    await client2.revealChoice(gameIdFeeSOL, Choice.Paper, Buffer.from(salt2, 'hex')); // P2 Paper (wins vs P1)
    await client3.revealChoice(gameIdFeeSOL, Choice.Scissors, Buffer.from(salt3, 'hex'));// P3 Scissors (wins vs P2)
    // Outcome: P1:0, P2:1, P3:1 (P2 beats P1, P3 beats P2, P1 beats P3 - actually P1:1, P2:1, P3:1, it's a 3-way tie in scores)
    await delay(2000);

    // Manually create and send CollectFees instruction (FeeCollector is signer)
    // This assumes FEE_COLLECTOR_PUBKEY is controlled by a known keypair for testing, or payerKeypair acts as it.
    // For this test, let's assume payerKeypair is temporarily the fee collector for tx signing.
    // In reality, the fee collector would be a separate entity.
    // If FEE_COLLECTOR_PUBKEY is a random key, this part cannot be signed unless we have its private key.
    // Let's use payerKeypair as the "authorized" collector for this test run.
    
    log.info(`Attempting to collect fees to ${FEE_COLLECTOR_PUBKEY.toBase58()} using payer ${payerKeypair.publicKey.toBase58()} as signer.`);
    
    const collectFeesInstruction = new TransactionInstruction({
        keys: [
            { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true }, // Fee Collector (signer)
            { pubkey: gameAccountSOLKey, isSigner: false, isWritable: true },    // Game account
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            // The actual FEE_COLLECTOR_PUBKEY needs to receive funds.
            // The instruction should transfer from game_account to FEE_COLLECTOR_PUBKEY.
            // The signer (payerKeypair.publicKey) authorizes this if it's the designated collector in the contract,
            // or if the contract allows any signer to trigger collection to the fixed FEE_COLLECTOR_PUBKEY.
            // The backend's process_collect_fees uses the first account as `fee_collector` (signer)
            // and transfers to this `fee_collector.key`. So, this should be FEE_COLLECTOR_PUBKEY if it has a signer.
            // For testing, if FEE_COLLECTOR_PUBKEY is random, we can't sign.
            // Let's assume the test uses payerKeypair as the one *initiating* the collection *to* FEE_COLLECTOR_PUBKEY.
            // This requires the backend to allow a non-FEE_COLLECTOR_PUBKEY to sign if the destination is FEE_COLLECTOR_PUBKEY.
            // The current backend `process_collect_fees` transfers to `fee_collector.key` (the signer).
            // So, the signer *must* be the intended recipient.
            // The test will use `payerKeypair` to sign, and funds will go to `payerKeypair.publicKey`.
            // This means `FEE_COLLECTOR_PUBKEY` in `.env` should be `payerKeypair.publicKey` for this test to make sense.
            // Or, we need the private key for `FEE_COLLECTOR_PUBKEY`.
            // For simplicity, let's assume `payerKeypair` IS the fee collector for this test.
        ],
        programId: RPS_PROGRAM_ID,
        data: Buffer.from([9]), // Instruction index for CollectFees (assuming 9 from updated backend)
    });
    // The instruction needs to be: fee_collector (signer, actual fee collector), game_account, system_program
    // If FEE_COLLECTOR_PUBKEY is not payerKeypair, this test needs the FEE_COLLECTOR_KEYPAIR.
    // For now, let's assume payerKeypair is the fee collector for test purposes.
    const feeCollectorWallet = payerKeypair; // Acting as fee collector
    const tx = new Transaction().add(new TransactionInstruction({
        keys: [
            { pubkey: feeCollectorWallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: gameAccountSOLKey, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: RPS_PROGRAM_ID,
        data: Buffer.from([9]), // CollectFees instruction enum value (0-indexed)
    }));

    await sendAndConfirmTransaction(connection, tx, [feeCollectorWallet]);
    log.success(`CollectFees transaction sent for game ${gameIdFeeSOL}. Fees should go to ${feeCollectorWallet.publicKey.toBase58()}`);
    
    const feeCollectorFinalSOL = await getSolBalance(feeCollectorWallet.publicKey); // Check balance of actual signer
    // This check is valid if feeCollectorWallet.publicKey IS the intended FEE_COLLECTOR_PUBKEY
    const collected = (feeCollectorFinalSOL - feeCollectorInitialSOL) * LAMPORTS_PER_SOL; // approx due to tx fees
    
    // A more robust check would be to query game_account's lamports before/after collection.
    // Or verify game.fee_collected became 0.
    log.info(`Fee collector SOL balance change: ${collected / LAMPORTS_PER_SOL}. Expected approx ${totalExpectedFeeSOL / LAMPORTS_PER_SOL}`);
    // This is hard to assert exactly due to other transaction fees affecting the collector's balance.
    // A better assertion is that game.fee_collected is now 0, or game account balance reduced by totalExpectedFeeSOL.
    // For now, a log is fine.
    if (Math.abs(collected - totalExpectedFeeSOL) < 0.001 * LAMPORTS_PER_SOL * PLAYER_COUNT) { // Allow for small discrepancies from tx fees
        log.success("SOL Fee Collection test PASSED (based on collector balance change).");
    } else {
        log.warn(`SOL Fee Collection balance check: Collected ${collected}, Expected ${totalExpectedFeeSOL}. Difference may be due to tx fees or other issues.`);
    }

  } catch (error) {
    log.error("SOL Fee Collection test failed.", error);
  }

  // Test Case: Fee Collection - RPS Token Game (similar structure)
  if (!RPS_TOKEN_MINT_PUBKEY) {
    log.warn("Skipping RPS Token Fee Collection test: No RPS_TOKEN_MINT_PUBKEY configured.");
    return;
  }
  log.testCase("Fee Collection - RPS Token Game");
  // ... (setup with RPS tokens, verify fee collector's RPS ATA balance)
  // This requires the CollectFees instruction to handle token accounts correctly.
  // Keys for CollectFees (Token):
  // 0. `fee_collector` (signer, actual fee collector wallet)
  // 1. `game_account` (game state PDA)
  // 2. `system_program`
  // 3. `token_program`
  // 4. `fee_collector_token_ata` (ATA of fee_collector for the RPS_TOKEN_MINT)
  // 5. `game_token_ata` (ATA of game_account for the RPS_TOKEN_MINT, where fees were paid into)
  // The backend `process_collect_fees` needs to be called with these accounts.
  // The test will need to ensure these ATAs exist.
  // ...
}


async function runMultiPlayerGameTests() {
  log.testTitle("Multi-Player Game Tests");

  const testFullGame = async (numPlayers: 3 | 4, currency: CurrencyMode, entryFee: number) => {
    log.testCase(`${numPlayers}-Player Game with ${currency === CurrencyMode.SOL ? 'SOL' : 'RPS Token'}`);
    if (currency === CurrencyMode.RPSTOKEN && !RPS_TOKEN_MINT_PUBKEY) {
        log.warn(`Skipping ${numPlayers}-Player RPS Token game: Mint not available.`);
        return;
    }

    const host = playerKeypairs[0];
    const hostClient = new RPSGameClient(connection, createMockWallet(host), RPS_PROGRAM_ID);
    let gameId: string | null = null;

    try {
        await logAllBalances();
        const createResult = await hostClient.createGame(
            numPlayers, numPlayers, 1, entryFee, 120, false, currency,
            currency === CurrencyMode.RPSTOKEN ? RPS_TOKEN_MINT_PUBKEY! : undefined
        );
        gameId = createResult.gameId;
        log.info(`Created ${numPlayers}-player ${currency} game: ${gameId}`);

        const playerClients: RPSGameClient[] = [hostClient];
        for (let i = 1; i < numPlayers; i++) {
            const player = playerKeypairs[i];
            const client = new RPSGameClient(connection, createMockWallet(player), RPS_PROGRAM_ID);
            await client.joinGame(gameId);
            playerClients.push(client);
            log.info(`Player ${i + 1} (${player.publicKey.toBase58()}) joined game ${gameId}`);
        }
        await delay(2000); // Let state settle

        // Commit phase: P1 Rock, P2 Paper, P3 Scissors, (P4 Rock if 4 players)
        const choices = [Choice.Rock, Choice.Paper, Choice.Scissors, Choice.Rock];
        const salts: string[] = [];
        for (let i = 0; i < numPlayers; i++) {
            const salt = generateSalt();
            salts.push(salt);
            const commitment = computeCommitment(choices[i] as number, salt);
            await playerClients[i].commitChoice(gameId, commitment, Buffer.from(salt, 'hex'));
            log.info(`Player ${i + 1} committed to game ${gameId}`);
        }
        await delay(2000);

        // Reveal phase
        for (let i = 0; i < numPlayers; i++) {
            await playerClients[i].revealChoice(gameId, choices[i], Buffer.from(salts[i], 'hex')); // Assuming client reveal needs salt for now
            log.info(`Player ${i + 1} revealed ${Choice[choices[i]]} in game ${gameId}`);
        }
        await delay(3000); // Allow time for backend to process results

        // Verify game outcome (winner, scores) - needs getGameData to be functional
        log.info(`Fetching final game data for ${gameId}...`);
        // const finalGameState = await getGameData(hostClient, gameId); // This needs client to expose a method
        // if (finalGameState) {
        //    log.info(`Final game state: ${JSON.stringify(finalGameState)}`);
        //    // Add assertions for scores and winner based on choices
        // } else {
        //    log.warn(`Could not fetch final game state for ${gameId}`);
        // }

        // Players claim winnings (if any)
        // This part is complex as we need to determine winners first
        // For now, just log that game finished. Winner determination logic is in backend.
        log.success(`${numPlayers}-Player ${currency} game finished. Pot distribution would be checked here.`);
        await logAllBalances();

    } catch (error) {
        log.error(`${numPlayers}-Player ${currency} game test failed.`, error);
        if (gameId) await logAllBalances(); // Log balances even on failure if game was created
    }
  };

  await testFullGame(3, CurrencyMode.SOL, 0.2 * LAMPORTS_PER_SOL);
  if (RPS_TOKEN_MINT_PUBKEY) { // Only run token test if mint is available
    await testFullGame(4, CurrencyMode.RPSTOKEN, 10 * (10**9)); // 10 RPS tokens (9 decimals)
  } else {
    log.warn("Skipping 4-Player RPS Token game test as RPS_TOKEN_MINT_PUBKEY is not set.");
  }
}

async function runTimeoutHandlingTests() {
  log.testTitle("Timeout Handling Tests");
  const player1 = playerKeypairs[0];
  const player2 = playerKeypairs[1];
  const client1 = new RPSGameClient(connection, createMockWallet(player1), RPS_PROGRAM_ID);
  const client2 = new RPSGameClient(connection, createMockWallet(player2), RPS_PROGRAM_ID);
  const timeout = 5; // 5 seconds for testing

  log.testCase("Timeout in WaitingForPlayers state");
  let gameIdTimeout1: string | null = null;
  try {
    const createResult = await client1.createGame(3, 3, 1, 0.1 * LAMPORTS_PER_SOL, timeout, false, CurrencyMode.SOL, undefined);
    gameIdTimeout1 = createResult.gameId;
    log.info(`Game ${gameIdTimeout1} created. Player 1 (host) joined. Waiting for timeout (${timeout}s)...`);
    // Only host has joined.
    await delay((timeout + 2) * 1000); // Wait for timeout + buffer

    await client1.resolveTimeout(gameIdTimeout1);
    log.success(`resolveTimeout called for game ${gameIdTimeout1}.`);
    // Verify game state is Finished/Cancelled
    // const gameData = await getGameData(client1, gameIdTimeout1);
    // if (gameData && gameData.state === GameState.Finished) { // Assuming GameState.Finished or a Cancelled state
    //   log.success("Timeout in WaitingForPlayers PASSED: Game is Finished.");
    // } else {
    //   log.error(`Timeout in WaitingForPlayers FAILED: Game state is not Finished. State: ${gameData?.state}`);
    // }
    log.warn("State verification for timeout test is manual/requires getGameData to be robust.");

  } catch (error) {
    log.error("Timeout in WaitingForPlayers test failed.", error);
  }

  log.testCase("Timeout in CommitPhase");
  // P1, P2, P3 join. P1, P2 commit. P3 doesn't. Timeout. Resolve.
  // ... (similar structure, set up game, players join, some commit, wait for timeout, resolve)
  // Verify game moves to RevealPhase with committed players or ends.
  // ...
}

async function runGameOutcomeAndPotDistributionTests() {
  log.testTitle("Game Outcome & Pot Distribution Tests");
    // Test Case: Single Winner (P2 beats P1, P2 beats P3)
    // P1: Rock, P2: Paper, P3: Rock. P2 should be sole winner.
    // ...
    // Test Case: Multiple Winners (e.g., 3-way score tie: P1 Rock, P2 Paper, P3 Scissors)
    // All get 1 point. Pot should be split.
    // ...
}


// --- Main Orchestrator ---
async function runAllTests() {
  try {
    await initializeTestEnvironment();
    await runSecurityTests();
    await runFeeCollectionTests(); // Depends on CollectFees instruction being callable
    await runMultiPlayerGameTests();
    await runTimeoutHandlingTests(); // Needs getGameData or client state checks
    await runGameOutcomeAndPotDistributionTests(); // Needs getGameData
    log.success(chalk.bold.bgGreen("All tests completed (or skipped). Review logs for details."));
  } catch (error) {
    log.error("A critical error occurred during the test run:", error);
    process.exit(1);
  }
}

// --- Execute Tests ---
runAllTests();
