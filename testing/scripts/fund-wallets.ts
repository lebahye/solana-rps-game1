import { Connection, clusterApiUrl } from '@solana/web3.js';
import { loadWallet, fundWallet, getBalance } from '../utils/solana-helpers';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Read config
const config = fs.readJsonSync(path.join(__dirname, '../config.json'));

// Path to wallets directory
const walletsDir = path.join(__dirname, '../wallets');

// Setup Solana connection
const connection = new Connection(config.networkUrl || clusterApiUrl('devnet'), 'confirmed');

/**
 * Fund all test wallets
 */
async function main() {
  console.log(chalk.blue('Funding test wallets...'));

  try {
    // Get wallet files
    const walletFiles = await fs.readdir(walletsDir);
    const walletLabels = walletFiles
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    if (walletLabels.length === 0) {
      console.log(chalk.yellow('No wallet files found. Please run "npm run generate-wallets" first.'));
      return;
    }

    console.log(`Found ${walletLabels.length} wallet files`);

    // Load and fund each wallet
    for (const label of walletLabels) {
      console.log(`\nProcessing wallet: ${label}`);

      try {
        // Load wallet
        const wallet = await loadWallet(label, walletsDir);

        // Check current balance
        const currentBalance = await getBalance(connection, wallet.publicKey);
        console.log(`Current balance: ${currentBalance} SOL`);

        // Fund if balance is below threshold (0.5 SOL)
        if (currentBalance < 0.5) {
          console.log(`Funding wallet with ${config.testWallets.fundAmount} SOL...`);
          const signature = await fundWallet(connection, wallet, config.testWallets.fundAmount);
          console.log(`Transaction: ${signature}`);

          // Wait a bit for the transaction to be confirmed
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Check new balance
          const newBalance = await getBalance(connection, wallet.publicKey);
          console.log(`New balance: ${newBalance} SOL`);
        } else {
          console.log(chalk.green(`Wallet already has sufficient funds (${currentBalance} SOL)`));
        }
      } catch (error) {
        console.error(chalk.red(`Error processing wallet ${label}:`), error);
      }
    }

    console.log(chalk.green('\n✓ Successfully funded wallets'));
    console.log(chalk.yellow('\nNext step: Run tests with "npm run test-fairness" or "npm run test-fees"\n'));
  } catch (error) {
    console.error(chalk.red('Error funding wallets:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
