import { Connection, clusterApiUrl } from '@solana/web3.js';
import {
  loadWallet,
  createGame,
  joinGame,
  commitChoice,
  revealChoice,
  generateRandomSalt
} from '../utils/solana-helpers';
import { Choice, CurrencyMode, TestWallet } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Read config
const config = fs.readJsonSync(path.join(__dirname, '../config.json'));

// Path to wallets directory
const walletsDir = path.join(__dirname, '../wallets');

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

// Setup Solana connection
const connection = new Connection(config.networkUrl || clusterApiUrl('devnet'), 'confirmed');

/**
 * Run a complete game cycle with specified players
 */
async function runGameCycle(
  host: TestWallet,
  players: TestWallet[],
  gameIndex: number,
  wagerAmount = 0.01
): Promise<{
  success: boolean,
  gameId?: string,
  elapsedMs: number,
  errors?: string[]
}> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    console.log(`[Game ${gameIndex}] Creating new game...`);

    // Create a new game
    const { gameId, gameAccount } = await createGame(
      connection,
      host,
      players.length, // minPlayers
      players.length, // maxPlayers
      1, // totalRounds
      wagerAmount, // entryFee
      30, // timeoutSeconds
      false, // losersCanRejoin
      CurrencyMode.SOL
    );

    console.log(`[Game ${gameIndex}] Game created: ${gameId}`);

    // Players join the game
    console.log(`[Game ${gameIndex}] ${players.length} players joining game...`);

    const joinPromises = players.map(player =>
      joinGame(connection, player, gameAccount, wagerAmount, CurrencyMode.SOL)
    );

    await Promise.all(joinPromises);
    console.log(`[Game ${gameIndex}] All players joined`);

    // Generate choices and salts
    const playerChoices = players.map(() => Math.floor(Math.random() * 3) + 1 as Choice);
    const hostChoice = Math.floor(Math.random() * 3) + 1 as Choice;

    const playerSalts = players.map(() => generateRandomSalt());
    const hostSalt = generateRandomSalt();

    // Commit choices
    console.log(`[Game ${gameIndex}] Committing choices...`);

    const hostCommitPromise = commitChoice(connection, host, gameAccount, hostChoice, hostSalt);
    const playerCommitPromises = players.map((player, index) =>
      commitChoice(connection, player, gameAccount, playerChoices[index], playerSalts[index])
    );

    await Promise.all([hostCommitPromise, ...playerCommitPromises]);
    console.log(`[Game ${gameIndex}] All choices committed`);

    // Reveal choices
    console.log(`[Game ${gameIndex}] Revealing choices...`);

    const hostRevealPromise = revealChoice(connection, host, gameAccount, hostChoice, hostSalt);
    const playerRevealPromises = players.map((player, index) =>
      revealChoice(connection, player, gameAccount, playerChoices[index], playerSalts[index])
    );

    await Promise.all([hostRevealPromise, ...playerRevealPromises]);
    console.log(`[Game ${gameIndex}] All choices revealed`);

    // Game complete
    const elapsedMs = Date.now() - startTime;
    console.log(`[Game ${gameIndex}] Completed in ${(elapsedMs / 1000).toFixed(2)}s`);

    return {
      success: true,
      gameId,
      elapsedMs
    };
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(chalk.red(`[Game ${gameIndex}] Error: ${error.message}`));
    errors.push(error.message || 'Unknown error');

    return {
      success: false,
      elapsedMs,
      errors
    };
  }
}

/**
 * Run load tests with concurrent games
 */
async function main() {
  console.log(chalk.blue('Running load tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Load wallets
    const walletFiles = await fs.readdir(walletsDir);
    const walletLabels = walletFiles
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    if (walletLabels.length < 6) {
      console.error(chalk.red('Need at least 6 wallets for load testing. Please run "npm run generate-wallets" first.'));
      return;
    }

    // Load all wallets
    const wallets: TestWallet[] = [];
    for (const label of walletLabels) {
      const wallet = await loadWallet(label, walletsDir);
      wallets.push(wallet);
    }

    console.log(`Loaded ${wallets.length} wallets for testing`);

    // Get number of concurrent games to run
    const concurrentGames = config.testRuns.concurrentGames || 5;
    console.log(`Running load test with ${concurrentGames} concurrent games...`);

    // Prepare wallet groups for each game
    const walletGroups: {
      host: TestWallet;
      players: TestWallet[];
    }[] = [];

    // Organize wallets into groups
    let walletIndex = 0;
    for (let i = 0; i < concurrentGames; i++) {
      // Each game needs 1 host + 2 players
      if (walletIndex + 3 > wallets.length) {
        console.warn(chalk.yellow(`Not enough wallets for ${concurrentGames} games. Running with ${i} games instead.`));
        break;
      }

      walletGroups.push({
        host: wallets[walletIndex++],
        players: [wallets[walletIndex++], wallets[walletIndex++]]
      });
    }

    // Start load test
    const startTime = Date.now();
    const results = [];

    // Run all games concurrently
    const gamePromises = walletGroups.map((group, index) =>
      runGameCycle(group.host, group.players, index + 1)
    );

    const gameResults = await Promise.all(gamePromises);

    // Calculate statistics
    const totalGames = gameResults.length;
    const successfulGames = gameResults.filter(r => r.success).length;
    const averageTimeMs = gameResults.reduce((sum, r) => sum + r.elapsedMs, 0) / totalGames;
    const successRate = (successfulGames / totalGames) * 100;

    // Max concurrent games that were successful
    const maxConcurrentGames = successfulGames;

    // Save results
    const resultsPath = path.join(resultsDir, 'load-test-results.json');
    const resultData = {
      testDate: new Date().toISOString(),
      totalConcurrentGames: totalGames,
      successfulGames,
      failedGames: totalGames - successfulGames,
      successRate: `${successRate.toFixed(2)}%`,
      averageTimeMs,
      averageTimeFormatted: `${(averageTimeMs / 1000).toFixed(2)}s`,
      gameResults: gameResults.map((result, index) => ({
        gameIndex: index + 1,
        success: result.success,
        gameId: result.gameId,
        timeMs: result.elapsedMs,
        timeFormatted: `${(result.elapsedMs / 1000).toFixed(2)}s`,
        errors: result.errors
      }))
    };

    await fs.writeJson(resultsPath, resultData, { spaces: 2 });

    // Print results
    console.log(chalk.yellow('\n====== LOAD TEST RESULTS ======\n'));
    console.log(`Total Concurrent Games: ${totalGames}`);
    console.log(`Successful Games: ${successfulGames} (${successRate.toFixed(2)}%)`);
    console.log(`Average Game Time: ${(averageTimeMs / 1000).toFixed(2)}s`);
    console.log(`\nMax Successful Concurrent Games: ${maxConcurrentGames}`);

    if (successRate === 100) {
      console.log(chalk.green('\n✓ All games completed successfully'));
    } else {
      console.log(chalk.yellow(`\nⓘ ${totalGames - successfulGames} games failed to complete`));
    }

    console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

    // Recovery test: If any games failed, try again with half the load
    if (successRate < 100 && concurrentGames > 1) {
      console.log(chalk.yellow('\n\nRunning recovery test with reduced load...'));

      // Wait a bit to let system recover
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Run half the number of games
      const reducedConcurrent = Math.max(1, Math.floor(concurrentGames / 2));
      const reducedWalletGroups = walletGroups.slice(0, reducedConcurrent);

      console.log(`Testing with ${reducedConcurrent} concurrent games`);

      const recoveryPromises = reducedWalletGroups.map((group, index) =>
        runGameCycle(group.host, group.players, index + 1)
      );

      const recoveryResults = await Promise.all(recoveryPromises);

      // Calculate recovery statistics
      const recoverySuccessful = recoveryResults.filter(r => r.success).length;
      const recoverySuccessRate = (recoverySuccessful / reducedConcurrent) * 100;

      console.log(chalk.yellow('\n====== RECOVERY TEST RESULTS ======\n'));
      console.log(`Total Games: ${reducedConcurrent}`);
      console.log(`Successful Games: ${recoverySuccessful} (${recoverySuccessRate.toFixed(2)}%)`);

      if (recoverySuccessRate === 100) {
        console.log(chalk.green('\n✓ System recovered successfully with reduced load'));
      } else {
        console.log(chalk.red('\n✗ System failed to recover even with reduced load'));
      }

      // Save recovery results
      const recoveryPath = path.join(resultsDir, 'recovery-test-results.json');
      const recoveryData = {
        testDate: new Date().toISOString(),
        totalConcurrentGames: reducedConcurrent,
        successfulGames: recoverySuccessful,
        failedGames: reducedConcurrent - recoverySuccessful,
        successRate: `${recoverySuccessRate.toFixed(2)}%`,
        gameResults: recoveryResults.map((result, index) => ({
          gameIndex: index + 1,
          success: result.success,
          gameId: result.gameId,
          timeMs: result.elapsedMs,
          timeFormatted: `${(result.elapsedMs / 1000).toFixed(2)}s`,
          errors: result.errors
        }))
      };

      await fs.writeJson(recoveryPath, recoveryData, { spaces: 2 });
      console.log(chalk.green(`Recovery results saved to: ${recoveryPath}`));
    }

  } catch (error) {
    console.error(chalk.red('Error running load tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
