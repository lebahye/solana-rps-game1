import { Connection, clusterApiUrl } from '@solana/web3.js';
import {
  loadWallet,
  createGame,
  joinGame,
  commitChoice,
  revealChoice,
  generateRandomSalt
} from '../utils/solana-helpers';
import { analyzeFairness, printFairnessResults, saveFairnessResults } from '../utils/game-analyzer';
import { Choice, CurrencyMode, GameOutcome, TestGame, TestWallet } from '../types';
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
 * Run fairness tests
 */
async function main() {
  console.log(chalk.blue('Running fairness tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Load wallets
    const walletFiles = await fs.readdir(walletsDir);
    const walletLabels = walletFiles
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    if (walletLabels.length < 3) {
      console.error(chalk.red('Need at least 3 wallets for testing. Please run "npm run generate-wallets" first.'));
      return;
    }

    // Load all wallets
    const wallets: TestWallet[] = [];
    for (const label of walletLabels) {
      const wallet = await loadWallet(label, walletsDir);
      wallets.push(wallet);
    }

    console.log(`Loaded ${wallets.length} wallets for testing`);

    // Game outcomes storage
    const gameResults: {
      playerChoice: Choice;
      opponentChoice: Choice;
      result: GameOutcome;
    }[] = [];

    // Run the specified number of fairness tests
    const testCount = config.testRuns.fairnessTests;
    console.log(`Running ${testCount} fairness tests...`);

    for (let i = 0; i < testCount; i++) {
      try {
        console.log(`\nTest ${i + 1}/${testCount}:`);

        // Select host and players
        const host = wallets[0];
        const player1 = wallets[1];
        const player2 = wallets[2];

        // Create a new game
        console.log("Creating game...");
        const { gameId, gameAccount, transactionId } = await createGame(
          connection,
          host,
          3, // minPlayers
          3, // maxPlayers
          1, // totalRounds
          0.01, // entryFee (small for testing)
          30, // timeoutSeconds
          false, // losersCanRejoin
          CurrencyMode.SOL
        );

        console.log(`Game created: ${gameId}`);
        console.log(`Transaction: ${transactionId}`);

        // Players join the game
        console.log("Players joining game...");
        await joinGame(connection, player1, gameAccount, 0.01, CurrencyMode.SOL);
        await joinGame(connection, player2, gameAccount, 0.01, CurrencyMode.SOL);

        // Generate random choices for each player
        const hostChoice = Math.floor(Math.random() * 3) + 1 as Choice;
        const player1Choice = Math.floor(Math.random() * 3) + 1 as Choice;
        const player2Choice = Math.floor(Math.random() * 3) + 1 as Choice;

        // Generate salts
        const hostSalt = generateRandomSalt();
        const player1Salt = generateRandomSalt();
        const player2Salt = generateRandomSalt();

        // Commit choices
        console.log("Committing choices...");
        await commitChoice(connection, host, gameAccount, hostChoice, hostSalt);
        await commitChoice(connection, player1, gameAccount, player1Choice, player1Salt);
        await commitChoice(connection, player2, gameAccount, player2Choice, player2Salt);

        // Reveal choices
        console.log("Revealing choices...");
        await revealChoice(connection, host, gameAccount, hostChoice, hostSalt);
        await revealChoice(connection, player1, gameAccount, player1Choice, player1Salt);
        await revealChoice(connection, player2, gameAccount, player2Choice, player2Salt);

        // Determine outcomes (focusing on host vs player1 for simplicity)
        if (hostChoice === player1Choice) {
          gameResults.push({
            playerChoice: hostChoice,
            opponentChoice: player1Choice,
            result: 'tie'
          });
        } else if (
          (hostChoice === Choice.Rock && player1Choice === Choice.Scissors) ||
          (hostChoice === Choice.Paper && player1Choice === Choice.Rock) ||
          (hostChoice === Choice.Scissors && player1Choice === Choice.Paper)
        ) {
          gameResults.push({
            playerChoice: hostChoice,
            opponentChoice: player1Choice,
            result: 'win'
          });
        } else {
          gameResults.push({
            playerChoice: hostChoice,
            opponentChoice: player1Choice,
            result: 'loss'
          });
        }

        console.log(`Game ${i + 1} completed`);

        // Wait a bit between games
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(chalk.red(`Error in test ${i + 1}:`), error);
      }
    }

    // Analyze results
    console.log(chalk.yellow('\nAnalyzing fairness of game outcomes...\n'));
    const fairnessResults = analyzeFairness(gameResults);

    // Print and save results
    printFairnessResults(fairnessResults);

    const resultsPath = path.join(resultsDir, 'fairness-results.json');
    saveFairnessResults(fairnessResults, resultsPath);

    console.log(chalk.green(`Results saved to: ${resultsPath}`));
  } catch (error) {
    console.error(chalk.red('Error running fairness tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
