import { analyzeFees, printFeeAnalysis } from '../utils/game-analyzer';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

// Expected fee percentage from typical config
const expectedFeePercentage = 0.001; // 0.1%

/**
 * Generate mock transaction data with fees
 */
function generateMockTransactionData(count: number, wagerAmounts: number[]): any[] {
  const transactions = [];

  for (let i = 0; i < count; i++) {
    // Select a wager amount randomly from the provided amounts
    const wagerAmount = wagerAmounts[Math.floor(Math.random() * wagerAmounts.length)];

    // Calculate the expected fee (0.1% of wager)
    const expectedFee = wagerAmount * expectedFeePercentage;

    // Add random noise to simulate blockchain variability (±1% of the fee amount)
    const noise = (Math.random() * 0.02 - 0.01) * expectedFee;
    const actualFee = expectedFee + noise;

    transactions.push({
      signature: `mock-tx-${i}`,
      preBalance: 10 + wagerAmount, // Some arbitrary balance
      postBalance: 10, // Simulated ending balance
      fee: actualFee, // This is the game fee (0.1% of wager)
      feeChange: wagerAmount  // This is the amount wagered
    });
  }

  return transactions;
}

/**
 * Run mock fee tests
 */
async function main() {
  console.log(chalk.blue('Running mock fee collection tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Define some test wager amounts
    const wagerAmounts = [0.01, 0.05, 0.1, 0.5, 1.0];

    // Generate mock transaction data
    const transactionCount = 100;
    console.log(`Generating ${transactionCount} mock transactions with varying wager amounts...`);
    const mockTransactions = generateMockTransactionData(transactionCount, wagerAmounts);

    // Analyze fees
    console.log(chalk.yellow('\nAnalyzing fee collection...\n'));
    const feeAnalysis = analyzeFees(mockTransactions, expectedFeePercentage);

    // Print fee analysis
    printFeeAnalysis(feeAnalysis, expectedFeePercentage);

    // Save results
    const resultsPath = path.join(resultsDir, 'mock-fee-results.json');
    await fs.writeJson(resultsPath, {
      testDate: new Date().toISOString(),
      transactionCount,
      wagerAmounts,
      expectedFeePercentage,
      actualFeePercentage: feeAnalysis.actualFeePercentage,
      totalWagered: feeAnalysis.totalWagered,
      totalFees: feeAnalysis.totalFees,
      isCorrect: feeAnalysis.isCorrect,
      differencePercentage: feeAnalysis.differencePercentage
    }, { spaces: 2 });

    console.log(chalk.green(`Results saved to: ${resultsPath}`));
  } catch (error) {
    console.error(chalk.red('Error running mock fee tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
