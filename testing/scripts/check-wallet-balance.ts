import { Connection, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Path to wallets directory
const walletsDir = path.join(__dirname, '../wallets');

/**
 * Load wallet from file
 */
async function loadWallet(label: string): Promise<{ publicKey: string, keypair: Keypair }> {
  const filePath = path.join(walletsDir, `${label}.json`);

  if (!(await fs.pathExists(filePath))) {
    throw new Error(`Wallet file not found: ${filePath}`);
  }

  const secretKey = await fs.readJson(filePath);
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));

  return {
    publicKey: keypair.publicKey.toBase58(),
    keypair
  };
}

/**
 * Check wallet balance
 */
async function main() {
  try {
    // Connect to Solana devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Get wallet files
    const walletFiles = await fs.readdir(walletsDir);
    const walletLabels = walletFiles
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    console.log(chalk.blue(`Checking balance of ${walletLabels.length} wallets...\n`));

    // Check balance of each wallet
    for (const label of walletLabels) {
      const wallet = await loadWallet(label);
      const balance = await connection.getBalance(wallet.keypair.publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      console.log(`Wallet: ${label}`);
      console.log(`Public Key: ${wallet.publicKey}`);
      console.log(`Balance: ${solBalance} SOL (${balance} lamports)`);
      console.log('-----------------------------------');
    }
  } catch (error) {
    console.error(chalk.red('Error checking wallet balances:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
