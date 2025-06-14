import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { Choice, GameState } from '../types';
import * as crypto from 'crypto';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

/**
 * Simulated wallet for testing
 */
class MockWallet {
  id: string;
  balance: number;
  transactionHistory: any[];

  constructor(id: string, initialBalance: number = 10) {
    this.id = id;
    this.balance = initialBalance;
    this.transactionHistory = [];
  }

  recordTransaction(type: string, amount: number, details: any = {}) {
    const transaction = {
      timestamp: Date.now(),
      type,
      amount,
      balanceBefore: this.balance,
      ...details
    };

    // Update balance
    if (type === 'debit') {
      this.balance -= amount;
    } else if (type === 'credit') {
      this.balance += amount;
    }

    transaction.balanceAfter = this.balance;
    this.transactionHistory.push(transaction);

    return transaction;
  }
}

/**
 * Simulated game contract
 */
class MockGameContract {
  games: Map<string, any>;
  feeCollector: string;
  feePercentage: number;
  feesCollected: number;
  totalWagered: number;

  constructor(feeCollector: string, feePercentage: number = 0.001) {
    this.games = new Map();
    this.feeCollector = feeCollector;
    this.feePercentage = feePercentage;
    this.feesCollected = 0;
    this.totalWagered = 0;
  }

  createGame(host: MockWallet, entryFee: number, timeoutSeconds: number = 30): { gameId: string } {
    const gameId = crypto.randomBytes(8).toString('hex');

    // Calculate fee
    const fee = entryFee * this.feePercentage;

    // Deduct entry fee + fee from host wallet
    host.recordTransaction('debit', entryFee + fee, {
      gameId,
      action: 'create_game',
      fee
    });

    // Record fee collection
    this.feesCollected += fee;
    this.totalWagered += entryFee;

    // Create game state
    this.games.set(gameId, {
      id: gameId,
      host: host.id,
      entryFee,
      state: GameState.WaitingForPlayers,
      players: [host.id],
      commitments: {},
      choices: {},
      results: {},
      timeoutSeconds,
      createdAt: Date.now()
    });

    return { gameId };
  }

  joinGame(wallet: MockWallet, gameId: string): { success: boolean } {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.state !== GameState.WaitingForPlayers) {
      throw new Error(`Game ${gameId} is not in waiting state`);
    }

    if (game.players.includes(wallet.id)) {
      throw new Error(`Player ${wallet.id} already joined game ${gameId}`);
    }

    // Calculate fee
    const fee = game.entryFee * this.feePercentage;

    // Deduct entry fee + fee from wallet
    wallet.recordTransaction('debit', game.entryFee + fee, {
      gameId,
      action: 'join_game',
      fee
    });

    // Record fee collection
    this.feesCollected += fee;
    this.totalWagered += game.entryFee;

    // Add player to game
    game.players.push(wallet.id);

    // Don't transition to commit phase yet - wait until we have all players
    // We'll let the test control when we transition

    return { success: true };
  }

  startCommitPhase(gameId: string): { success: boolean } {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.state !== GameState.WaitingForPlayers) {
      throw new Error(`Game ${gameId} is not in waiting state`);
    }

    // Transition to commit phase
    game.state = GameState.CommitPhase;

    return { success: true };
  }

  commitChoice(wallet: MockWallet, gameId: string, choice: Choice, salt: string): { success: boolean } {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.state !== GameState.CommitPhase) {
      throw new Error(`Game ${gameId} is not in commit phase`);
    }

    if (!game.players.includes(wallet.id)) {
      throw new Error(`Player ${wallet.id} is not in game ${gameId}`);
    }

    if (game.commitments[wallet.id]) {
      throw new Error(`Player ${wallet.id} already committed a choice in game ${gameId}`);
    }

    // Calculate commitment hash
    const choiceData = choice.toString() + salt;
    const commitment = crypto.createHash('sha256').update(choiceData).digest('hex');

    // Record commitment
    game.commitments[wallet.id] = {
      commitment,
      timestamp: Date.now()
    };

    // Store the actual choice for testing (in real implementation this would be private)
    game._testingChoices = game._testingChoices || {};
    game._testingChoices[wallet.id] = { choice, salt };

    // Check if all players have committed
    const allCommitted = game.players.every(playerId => game.commitments[playerId]);

    if (allCommitted) {
      game.state = GameState.RevealPhase;
    }

    return { success: true };
  }

  revealChoice(wallet: MockWallet, gameId: string, choice: Choice, salt: string): { success: boolean } {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    if (game.state !== GameState.RevealPhase) {
      throw new Error(`Game ${gameId} is not in reveal phase`);
    }

    if (!game.players.includes(wallet.id)) {
      throw new Error(`Player ${wallet.id} is not in game ${gameId}`);
    }

    if (!game.commitments[wallet.id]) {
      throw new Error(`Player ${wallet.id} didn't commit a choice in game ${gameId}`);
    }

    if (game.choices[wallet.id]) {
      throw new Error(`Player ${wallet.id} already revealed a choice in game ${gameId}`);
    }

    // Verify commitment
    const choiceData = choice.toString() + salt;
    const commitment = crypto.createHash('sha256').update(choiceData).digest('hex');

    if (commitment !== game.commitments[wallet.id].commitment) {
      throw new Error(`Revealed choice doesn't match commitment for player ${wallet.id}`);
    }

    // Record choice
    game.choices[wallet.id] = choice;

    // Check if all players have revealed
    const allRevealed = game.players.every(playerId => game.choices[playerId]);

    if (allRevealed) {
      // Calculate results
      this.calculateResults(gameId);
      game.state = GameState.Finished;

      // Distribute winnings
      this.distributeWinnings(gameId);
    }

    return { success: true };
  }

  resolveTimeout(gameId: string): { success: boolean } {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }

    const currentTime = Date.now();
    const gameAgeSeconds = (currentTime - game.createdAt) / 1000;

    if (gameAgeSeconds < game.timeoutSeconds) {
      throw new Error(`Game ${gameId} timeout hasn't elapsed yet`);
    }

    // In real implementation, we would check which players haven't acted and penalize them
    // For testing, just finish the game
    game.state = GameState.Finished;

    return { success: true };
  }

  private calculateResults(gameId: string) {
    const game = this.games.get(gameId);

    // Calculate winner for each pair of players
    for (let i = 0; i < game.players.length; i++) {
      for (let j = i + 1; j < game.players.length; j++) {
        const player1Id = game.players[i];
        const player2Id = game.players[j];

        const player1Choice = game.choices[player1Id];
        const player2Choice = game.choices[player2Id];

        let result;

        if (player1Choice === player2Choice) {
          result = 'tie';
        } else if (
          (player1Choice === Choice.Rock && player2Choice === Choice.Scissors) ||
          (player1Choice === Choice.Paper && player2Choice === Choice.Rock) ||
          (player1Choice === Choice.Scissors && player2Choice === Choice.Paper)
        ) {
          result = 'player1Wins';
        } else {
          result = 'player2Wins';
        }

        game.results[`${player1Id}_vs_${player2Id}`] = result;
      }
    }

    // Calculate total wins for each player
    game.playerWins = {};
    game.players.forEach(playerId => {
      game.playerWins[playerId] = 0;
    });

    Object.entries(game.results).forEach(([matchup, result]) => {
      const [player1Id, player2Id] = matchup.split('_vs_');

      if (result === 'player1Wins') {
        game.playerWins[player1Id]++;
      } else if (result === 'player2Wins') {
        game.playerWins[player2Id]++;
      }
    });

    // Determine the overall winner
    let maxWins = -1;
    let winner = null;

    Object.entries(game.playerWins).forEach(([playerId, wins]) => {
      if (wins > maxWins) {
        maxWins = wins as number;
        winner = playerId;
      }
    });

    game.winner = winner;
  }

  private distributeWinnings(gameId: string) {
    const game = this.games.get(gameId);

    // For simplicity, winner takes all
    if (game.winner) {
      // Calculate total pot
      const pot = game.entryFee * game.players.length;

      // Find winner wallet
      const winnerWallet = this.findWalletById(game.winner);

      if (winnerWallet) {
        // Credit winnings to winner
        winnerWallet.recordTransaction('credit', pot, {
          gameId,
          action: 'win_payout'
        });
      }
    }
  }

  private findWalletById(id: string): MockWallet | null {
    // This is just for testing purposes
    // In a real implementation, this would interact with the blockchain
    return null;
  }

  // Register a wallet for testing purposes
  registerWallet(wallet: MockWallet) {
    this.findWalletById = (id: string) => {
      return id === wallet.id ? wallet : null;
    };
  }
}

/**
 * Run end-to-end integration tests
 */
async function runE2ETests() {
  console.log(chalk.blue('Running end-to-end integration tests...'));

  // Create test wallets
  const host = new MockWallet('host', 10);
  const player1 = new MockWallet('player1', 10);
  const player2 = new MockWallet('player2', 10);

  // Create game contract
  const feeCollector = 'feeCollector123';
  const gameContract = new MockGameContract(feeCollector);

  // Register wallets with contract for testing
  gameContract.registerWallet(host);
  gameContract.registerWallet(player1);
  gameContract.registerWallet(player2);

  // Initialize test results
  const testResults = [];

  // Define test cases
  const testCases = [
    {
      name: 'Complete Game Cycle',
      description: 'Test a complete game cycle from creation to payout',
      steps: [
        () => {
          console.log('Creating a new game...');
          const entryFee = 0.1;
          const { gameId } = gameContract.createGame(host, entryFee);
          return { success: true, gameId, message: `Game created with ID: ${gameId}` };
        },
        (context) => {
          console.log(`Player 1 joining game ${context.gameId}...`);
          const result = gameContract.joinGame(player1, context.gameId);
          return { ...result, message: 'Player 1 joined the game' };
        },
        (context) => {
          console.log(`Player 2 joining game ${context.gameId}...`);
          const result = gameContract.joinGame(player2, context.gameId);
          return { ...result, message: 'Player 2 joined the game' };
        },
        (context) => {
          console.log('Starting commit phase...');
          const result = gameContract.startCommitPhase(context.gameId);
          return { ...result, message: 'Commit phase started' };
        },
        (context) => {
          console.log('Players committing choices...');

          // Host commits Rock
          const hostChoice = Choice.Rock;
          const hostSalt = '0123456789abcdef';
          const hostResult = gameContract.commitChoice(host, context.gameId, hostChoice, hostSalt);

          // Player 1 commits Paper
          const player1Choice = Choice.Paper;
          const player1Salt = 'abcdef0123456789';
          const player1Result = gameContract.commitChoice(player1, context.gameId, player1Choice, player1Salt);

          // Player 2 commits Scissors
          const player2Choice = Choice.Scissors;
          const player2Salt = '9876543210abcdef';
          const player2Result = gameContract.commitChoice(player2, context.gameId, player2Choice, player2Salt);

          return {
            success: hostResult.success && player1Result.success && player2Result.success,
            message: 'All players committed their choices',
            hostChoice,
            player1Choice,
            player2Choice
          };
        },
        (context) => {
          console.log('Players revealing choices...');

          // Host reveals Rock
          const hostChoice = context.hostChoice;
          const hostSalt = '0123456789abcdef';
          const hostResult = gameContract.revealChoice(host, context.gameId, hostChoice, hostSalt);

          // Player 1 reveals Paper
          const player1Choice = context.player1Choice;
          const player1Salt = 'abcdef0123456789';
          const player1Result = gameContract.revealChoice(player1, context.gameId, player1Choice, player1Salt);

          // Player 2 reveals Scissors
          const player2Choice = context.player2Choice;
          const player2Salt = '9876543210abcdef';
          const player2Result = gameContract.revealChoice(player2, context.gameId, player2Choice, player2Salt);

          return {
            success: hostResult.success && player1Result.success && player2Result.success,
            message: 'All players revealed their choices'
          };
        },
        (context) => {
          console.log('Verifying game results...');

          const game = gameContract.games.get(context.gameId);

          if (game.state !== GameState.Finished) {
            return { success: false, message: 'Game did not finish properly' };
          }

          // Expected results:
          // - Rock (Host) vs Paper (Player1) = Player1 wins
          // - Rock (Host) vs Scissors (Player2) = Host wins
          // - Paper (Player1) vs Scissors (Player2) = Player2 wins

          const expectedResults = {
            'host_vs_player1': 'player2Wins', // Player 1 wins
            'host_vs_player2': 'player1Wins', // Host wins
            'player1_vs_player2': 'player2Wins'  // Player 2 wins
          };

          // Check if results match expected
          let resultsMatch = true;

          for (const [matchup, expectedResult] of Object.entries(expectedResults)) {
            const actualResult = game.results[matchup];
            if (actualResult !== expectedResult) {
              resultsMatch = false;
              console.log(`Mismatch for ${matchup}: expected ${expectedResult}, got ${actualResult}`);
            }
          }

          return {
            success: resultsMatch,
            message: resultsMatch ? 'Game results verified correctly' : 'Game results do not match expectations',
            winner: game.winner
          };
        },
        (context) => {
          console.log('Checking fee collection...');

          // Expected total wagered: 0.1 * 3 = 0.3
          // Expected fees: 0.3 * 0.001 = 0.0003

          const expectedTotalWagered = 0.3;
          const expectedFees = 0.0003;

          const feesCorrect = Math.abs(gameContract.feesCollected - expectedFees) < 0.00001;
          const wageredCorrect = Math.abs(gameContract.totalWagered - expectedTotalWagered) < 0.00001;

          return {
            success: feesCorrect && wageredCorrect,
            message: 'Fee collection verified',
            feesCollected: gameContract.feesCollected,
            totalWagered: gameContract.totalWagered
          };
        }
      ]
    },
    {
      name: 'Double Join Prevention',
      description: 'Test that a player cannot join the same game twice',
      steps: [
        () => {
          console.log('Creating a new game...');
          const entryFee = 0.1;
          const { gameId } = gameContract.createGame(host, entryFee);
          return { success: true, gameId, message: `Game created with ID: ${gameId}` };
        },
        (context) => {
          console.log(`Player 1 joining game ${context.gameId}...`);
          const result = gameContract.joinGame(player1, context.gameId);
          return { ...result, message: 'Player 1 joined the game' };
        },
        (context) => {
          console.log(`Player 1 attempting to join game ${context.gameId} again...`);
          try {
            const result = gameContract.joinGame(player1, context.gameId);
            return { success: false, message: 'Player 1 was able to join the game twice (FAIL)' };
          } catch (error) {
            return { success: true, message: 'Double join correctly prevented', error: error.message };
          }
        }
      ]
    },
    {
      name: 'Commitment Verification',
      description: 'Test that revealed choices must match commitments',
      steps: [
        () => {
          console.log('Creating a new game...');
          const entryFee = 0.1;
          const { gameId } = gameContract.createGame(host, entryFee);
          return { success: true, gameId, message: `Game created with ID: ${gameId}` };
        },
        (context) => {
          console.log(`Player 1 joining game ${context.gameId}...`);
          const result = gameContract.joinGame(player1, context.gameId);
          return { ...result, message: 'Player 1 joined the game' };
        },
        (context) => {
          console.log('Starting commit phase...');
          const result = gameContract.startCommitPhase(context.gameId);
          return { ...result, message: 'Commit phase started' };
        },
        (context) => {
          console.log('Host committing choice (Rock)...');
          const hostChoice = Choice.Rock;
          const hostSalt = '0123456789abcdef';
          const result = gameContract.commitChoice(host, context.gameId, hostChoice, hostSalt);
          return {
            ...result,
            message: 'Host committed Rock',
            hostChoice,
            hostSalt
          };
        },
        (context) => {
          console.log('Player 1 committing choice (Paper)...');
          const player1Choice = Choice.Paper;
          const player1Salt = 'abcdef0123456789';
          const result = gameContract.commitChoice(player1, context.gameId, player1Choice, player1Salt);
          return {
            ...result,
            message: 'Player 1 committed Paper'
          };
        },
        (context) => {
          console.log('Host trying to reveal a different choice (Scissors)...');
          try {
            const differentChoice = Choice.Scissors; // Different from committed Rock
            const result = gameContract.revealChoice(host, context.gameId, differentChoice, context.hostSalt);
            return { success: false, message: 'Host was able to reveal a different choice (FAIL)' };
          } catch (error) {
            return { success: true, message: 'Commitment verification correctly prevented cheat attempt', error: error.message };
          }
        }
      ]
    }
  ];

  // Run each test case
  for (const testCase of testCases) {
    console.log(chalk.yellow(`\n=== Running test: ${testCase.name} ===`));
    console.log(testCase.description);

    const context = {};
    const stepResults = [];
    let testPassed = true;

    for (let i = 0; i < testCase.steps.length; i++) {
      const step = testCase.steps[i];
      console.log(`\nStep ${i + 1}:`);

      try {
        const result = step(context);

        // Add result to context for next steps
        Object.assign(context, result);

        stepResults.push({
          step: i + 1,
          success: result.success,
          message: result.message
        });

        if (!result.success) {
          console.log(chalk.red(`Step ${i + 1} failed: ${result.message}`));
          testPassed = false;
          break;
        } else {
          console.log(chalk.green(`✓ ${result.message}`));
        }
      } catch (error) {
        console.error(chalk.red(`Error in step ${i + 1}:`), error);
        stepResults.push({
          step: i + 1,
          success: false,
          message: error.message
        });
        testPassed = false;
        break;
      }
    }

    testResults.push({
      name: testCase.name,
      description: testCase.description,
      success: testPassed,
      steps: stepResults
    });

    if (testPassed) {
      console.log(chalk.green(`\n✓ Test "${testCase.name}" passed`));
    } else {
      console.log(chalk.red(`\n✗ Test "${testCase.name}" failed`));
    }
  }

  // Save test results
  const resultsPath = path.join(resultsDir, 'e2e-integration-results.json');
  await fs.writeJson(resultsPath, {
    testDate: new Date().toISOString(),
    results: testResults
  }, { spaces: 2 });

  console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

  // Print summary
  console.log(chalk.yellow('\n====== E2E INTEGRATION TEST SUMMARY ======\n'));

  const passedTests = testResults.filter(t => t.success).length;
  const totalTests = testResults.length;

  console.log(`Tests Run: ${totalTests}`);
  console.log(`Tests Passed: ${passedTests} (${(passedTests / totalTests * 100).toFixed(0)}%)`);

  if (passedTests === totalTests) {
    console.log(chalk.green('\n✓ All integration tests passed!'));
  } else {
    console.log(chalk.red(`\n✗ ${totalTests - passedTests} tests failed.`));
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Run E2E integration tests
    await runE2ETests();
  } catch (error) {
    console.error(chalk.red('Error running E2E integration tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
