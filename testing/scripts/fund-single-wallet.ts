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
 * Fund a single wallet with a minimal amount
 */
async function main() {
  try {
    // Connect to Solana devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Only fund the first wallet with a minimal amount
    const walletLabel = 'player1';
    const wallet = await loadWallet(walletLabel);

    // Check current balance
    const currentBalance = await connection.getBalance(wallet.keypair.publicKey);
    console.log(`Wallet: ${walletLabel}`);
    console.log(`Public Key: ${wallet.publicKey}`);
    console.log(`Current Balance: ${currentBalance / LAMPORTS_PER_SOL} SOL`);

    // Fund with a minimal amount (just 0.05 SOL)
    const amountToFund = 0.05 * LAMPORTS_PER_SOL;
    console.log(`Funding wallet with ${amountToFund / LAMPORTS_PER_SOL} SOL...`);

    try {
      const signature = await connection.requestAirdrop(
        wallet.keypair.publicKey,
        amountToFund
      );

      console.log(`Transaction sent: ${signature}`);
      console.log('Waiting for confirmation...');

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Check new balance
      const newBalance = await connection.getBalance(wallet.keypair.publicKey);
      console.log(`New Balance: ${newBalance / LAMPORTS_PER_SOL} SOL`);

      console.log(chalk.green(`Successfully funded wallet ${walletLabel} with ${amountToFund / LAMPORTS_PER_SOL} SOL`));
    } catch (error) {
      if (error.message && error.message.includes('429')) {
        console.error(chalk.red('Rate limit exceeded. Please try again later.'));
      } else {
        console.error(chalk.red(`Error funding wallet: ${error.message}`));
      }
    }
  } catch (error) {
    console.error(chalk.red('Error in fund-single-wallet:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
