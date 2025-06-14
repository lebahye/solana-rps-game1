import {
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey
} from '@solana/web3.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Path to wallets directory
const walletsDir = path.join(__dirname, '../wallets');
const resultsDir = path.join(__dirname, '../results');

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
 * Run a minimal blockchain test
 */
async function main() {
  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    console.log(chalk.blue('Running minimal blockchain tests...'));

    // Connect to Solana devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    console.log('Connected to Solana devnet');

    // Store test results
    const testResults = [];

    // Test 1: Check Blockchain Status
    console.log(chalk.yellow('\nTest 1: Checking Blockchain Status'));
    try {
      const blockHeight = await connection.getBlockHeight();
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const supply = await connection.getSupply();

      console.log(`Block Height: ${blockHeight}`);
      console.log(`Current Slot: ${slot}`);
      console.log(`Block Time: ${new Date(blockTime * 1000).toISOString()}`);
      console.log(`Total Supply: ${supply.value.total / LAMPORTS_PER_SOL} SOL`);
      console.log(`Circulating Supply: ${supply.value.circulating / LAMPORTS_PER_SOL} SOL`);

      testResults.push({
        name: 'Blockchain Status Check',
        success: true,
        data: {
          blockHeight,
          slot,
          blockTime: new Date(blockTime * 1000).toISOString(),
          supply: {
            total: supply.value.total / LAMPORTS_PER_SOL,
            circulating: supply.value.circulating / LAMPORTS_PER_SOL
          }
        }
      });

      console.log(chalk.green('✓ Successfully retrieved blockchain status'));
    } catch (error) {
      console.error(chalk.red(`Error checking blockchain status: ${error.message}`));
      testResults.push({
        name: 'Blockchain Status Check',
        success: false,
        error: error.message
      });
    }

    // Test 2: Check Recent Transactions
    console.log(chalk.yellow('\nTest 2: Fetching Recent Transactions'));
    try {
      // Get a recent block
      const recentBlockhash = await connection.getLatestBlockhash();
      console.log(`Recent Blockhash: ${recentBlockhash.blockhash}`);

      // Fetch some transaction signatures from recent blocks
      const signatures = await connection.getSignaturesForAddress(
        new PublicKey('Vote111111111111111111111111111111111111111'),
        { limit: 5 }
      );

      console.log(`\nFound ${signatures.length} recent transactions`);

      if (signatures.length > 0) {
        console.log('\nRecent transaction details:');
        for (const sig of signatures.slice(0, 3)) {
          console.log(`- Signature: ${sig.signature.substring(0, 20)}...`);
          console.log(`  Slot: ${sig.slot}`);
          if (sig.blockTime) {
            console.log(`  Time: ${new Date(sig.blockTime * 1000).toISOString()}`);
          }
          if (sig.err) {
            console.log(`  Error: ${JSON.stringify(sig.err)}`);
          }
          console.log('');
        }
      }

      testResults.push({
        name: 'Recent Transactions Check',
        success: true,
        data: {
          recentBlockhash: recentBlockhash.blockhash,
          transactionCount: signatures.length,
          sampleTransactions: signatures.slice(0, 3).map(sig => ({
            signature: sig.signature,
            slot: sig.slot,
            blockTime: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
            hasError: !!sig.err
          }))
        }
      });

      console.log(chalk.green('✓ Successfully retrieved recent transactions'));
    } catch (error) {
      console.error(chalk.red(`Error fetching recent transactions: ${error.message}`));
      testResults.push({
        name: 'Recent Transactions Check',
        success: false,
        error: error.message
      });
    }

    // Test 3: Check Test Wallet Properties
    console.log(chalk.yellow('\nTest 3: Verifying Test Wallet Properties'));
    try {
      const wallet = await loadWallet('player1');
      console.log(`Wallet Public Key: ${wallet.publicKey}`);

      // Check if the account exists
      const accountInfo = await connection.getAccountInfo(wallet.keypair.publicKey);
      const exists = accountInfo !== null;
      console.log(`Account Exists: ${exists}`);

      // Get the minimum rent exemption
      const rentExemption = await connection.getMinimumBalanceForRentExemption(0);
      console.log(`Minimum Rent Exemption: ${rentExemption / LAMPORTS_PER_SOL} SOL`);

      testResults.push({
        name: 'Wallet Properties Check',
        success: true,
        data: {
          publicKey: wallet.publicKey,
          accountExists: exists,
          minimumRentExemption: rentExemption / LAMPORTS_PER_SOL
        }
      });

      console.log(chalk.green('✓ Successfully verified wallet properties'));
    } catch (error) {
      console.error(chalk.red(`Error checking wallet properties: ${error.message}`));
      testResults.push({
        name: 'Wallet Properties Check',
        success: false,
        error: error.message
      });
    }

    // Save results
    const resultsPath = path.join(resultsDir, 'minimal-blockchain-results.json');
    await fs.writeJson(resultsPath, {
      testDate: new Date().toISOString(),
      network: 'devnet',
      results: testResults
    }, { spaces: 2 });

    console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

    // Print summary
    const passedTests = testResults.filter(t => t.success).length;
    const totalTests = testResults.length;

    console.log(chalk.yellow('\n====== MINIMAL BLOCKCHAIN TEST SUMMARY ======'));
    console.log(`Tests Run: ${totalTests}`);
    console.log(`Tests Passed: ${passedTests} (${(passedTests / totalTests * 100).toFixed(0)}%)`);

    if (passedTests === totalTests) {
      console.log(chalk.green('\n✓ All blockchain tests passed!'));
    } else {
      console.log(chalk.red(`\n✗ ${totalTests - passedTests} tests failed.`));
    }

  } catch (error) {
    console.error(chalk.red('Error running minimal blockchain tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
