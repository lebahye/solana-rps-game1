import { generateWallet, saveWallet } from '../utils/solana-helpers';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk'; // Fixed import to use the compatible version

// Read config
const config = fs.readJsonSync(path.join(__dirname, '../config.json'));

// Path to wallets directory
const walletsDir = path.join(__dirname, '../wallets');

/**
 * Generate test wallets
 */
async function main() {
  console.log(chalk.blue('Generating test wallets...'));

  // Create wallets dir if it doesn't exist
  await fs.ensureDir(walletsDir);

  // Generate wallets
  const walletCount = config.testWallets.count;

  for (let i = 0; i < walletCount; i++) {
    const label = `player${i + 1}`;
    console.log(`Generating wallet for ${label}...`);

    const wallet = await generateWallet(label);

    // Save wallet to file
    await saveWallet(wallet, walletsDir);
  }

  console.log(chalk.green(`\n✓ Successfully generated ${walletCount} test wallets in ${walletsDir}`));
  console.log(chalk.yellow('\nNext step: Fund the wallets using "npm run fund-wallets"\n'));
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error generating wallets:'), err);
  process.exit(1);
});
