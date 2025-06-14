import { Connection, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import {
  loadWallet,
  createGame,
  joinGame,
  commitChoice,
  revealChoice,
  generateRandomSalt,
  getTransactionDetails
} from '../utils/solana-helpers';
import { analyzeFees, printFeeAnalysis } from '../utils/game-analyzer';
import { Choice, CurrencyMode, FeeAnalysis, TestWallet } from '../types';
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

// Fee collector address from config
const feeCollectorAddress = config.feeCollectorAddress;

// Expected fee percentage from config
const expectedFeePercentage = config.feePercentage || 0.001; // Default to 0.1%

/**
 * Run fee collection tests
 */
async function main() {
  console.log(chalk.blue('Running fee collection tests...'));

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

    // Fee analysis storage
    const feeResults: FeeAnalysis[] = [];

    // Run the specified number of fee tests with different wager amounts
    const testCount = config.testRuns.feeTests;
    console.log(`Running ${testCount} fee collection tests...`);

    for (let i = 0; i < testCount; i++) {
      try {
        console.log(`\nTest ${i + 1}/${testCount}:`);

        // Select wager amount from config or use random amount
        const wagerAmount = config.wagerAmounts[i % config.wagerAmounts.length];

        console.log(`Using wager amount: ${wagerAmount} SOL`);

        // Select host and players
        const host = wallets[0];
        const player1 = wallets[1];
        const player2 = wallets[2];

        // Track transaction signatures for later analysis
        const transactionSignatures: string[] = [];

        // Create a new game
        console.log("Creating game...");
        const { gameId, gameAccount, transactionId } = await createGame(
          connection,
          host,
          2, // minPlayers
          2, // maxPlayers
          1, // totalRounds
          wagerAmount, // entryFee
          30, // timeoutSeconds
          false, // losersCanRejoin
          CurrencyMode.SOL
        );

        transactionSignatures.push(transactionId);
        console.log(`Game created: ${gameId}`);
        console.log(`Transaction: ${transactionId}`);

        // Player joins the game
        console.log("Player joining game...");
        const joinTxId = await joinGame(connection, player1, gameAccount, wagerAmount, CurrencyMode.SOL);
        transactionSignatures.push(joinTxId);

        // Generate random choices for each player
        const hostChoice = Math.floor(Math.random() * 3) + 1 as Choice;
        const player1Choice = Math.floor(Math.random() * 3) + 1 as Choice;

        // Generate salts
        const hostSalt = generateRandomSalt();
        const player1Salt = generateRandomSalt();

        // Commit choices
        console.log("Committing choices...");
        const hostCommitTxId = await commitChoice(connection, host, gameAccount, hostChoice, hostSalt);
        const player1CommitTxId = await commitChoice(connection, player1, gameAccount, player1Choice, player1Salt);

        transactionSignatures.push(hostCommitTxId);
        transactionSignatures.push(player1CommitTxId);

        // Reveal choices
        console.log("Revealing choices...");
        const hostRevealTxId = await revealChoice(connection, host, gameAccount, hostChoice, hostSalt);
        const player1RevealTxId = await revealChoice(connection, player1, gameAccount, player1Choice, player1Salt);

        transactionSignatures.push(hostRevealTxId);
        transactionSignatures.push(player1RevealTxId);

        // Get transaction details for fee analysis
        const transactionDetails = [];

        for (const signature of transactionSignatures) {
          const details = await getTransactionDetails(connection, signature);
          if (details) {
            transactionDetails.push(details);
          }
        }

        // Analyze fees
        const feeAnalysis = analyzeFees(transactionDetails, expectedFeePercentage);

        // Print fee analysis
        printFeeAnalysis(feeAnalysis, expectedFeePercentage);

        // Store results
        feeResults.push({
          gameId,
          totalWagered: feeAnalysis.totalWagered,
          totalFees: feeAnalysis.totalFees,
          actualFeePercentage: feeAnalysis.actualFeePercentage,
          expectedFeePercentage: expectedFeePercentage * 100,
          difference: feeAnalysis.differencePercentage,
          transactions: transactionDetails.map(tx => ({
            signature: tx.signature,
            preBalance: tx.preBalance,
            postBalance: tx.postBalance,
            fee: tx.fee
          }))
        });

        console.log(`Fee test ${i + 1} completed`);

        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(chalk.red(`Error in test ${i + 1}:`), error);
      }
    }

    // Save fee test results
    const resultsPath = path.join(resultsDir, 'fee-results.json');
    await fs.writeJson(resultsPath, feeResults, { spaces: 2 });

    console.log(chalk.green(`Results saved to: ${resultsPath}`));

    // Calculate summary statistics
    const passedTests = feeResults.filter(r => r.difference < 0.05).length;
    const averageFeePercentage = feeResults.reduce((sum, r) => sum + r.actualFeePercentage, 0) / feeResults.length;
    const maxDifference = Math.max(...feeResults.map(r => r.difference));

    console.log(chalk.yellow('\nFee Collection Test Summary:'));
    console.log(`Tests Run: ${feeResults.length}`);
    console.log(`Tests Passed: ${passedTests} (${((passedTests / feeResults.length) * 100).toFixed(2)}%)`);
    console.log(`Average Fee Percentage: ${averageFeePercentage.toFixed(6)}%`);
    console.log(`Maximum Difference: ${maxDifference.toFixed(6)}%`);

    if (passedTests === feeResults.length) {
      console.log(chalk.green('\n✓ All fee tests passed!'));
    } else {
      console.log(chalk.yellow(`\nⓘ ${feeResults.length - passedTests} tests showed fee discrepancies.`));
    }

  } catch (error) {
    console.error(chalk.red('Error running fee tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
