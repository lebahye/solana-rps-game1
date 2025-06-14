import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as crypto from 'crypto';
import { Choice } from '../types';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

// Define the performance tests to run
const PERFORMANCE_TESTS = [
  {
    name: 'Commitment Hash Generation',
    description: 'Measures the performance of generating commitment hashes',
    iterations: 1000,
    run: benchmarkCommitmentHash
  },
  {
    name: 'Game State Transition',
    description: 'Measures the performance of game state transitions',
    iterations: 1000,
    run: benchmarkStateTransition
  },
  {
    name: 'Multi-Player Game Simulation',
    description: 'Simulates a complete multi-player game cycle',
    iterations: 100,
    run: benchmarkMultiPlayerGame
  },
  {
    name: 'Concurrent Games',
    description: 'Measures performance with multiple concurrent games',
    iterations: 10,
    concurrentGames: 5,
    run: benchmarkConcurrentGames
  },
  {
    name: 'Choice Verification',
    description: 'Measures the performance of verifying player choices',
    iterations: 1000,
    run: benchmarkChoiceVerification
  }
];

/**
 * Generate a random salt string
 */
function generateRandomSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Calculate commitment hash for a choice and salt
 */
function calculateCommitmentHash(choice: Choice, salt: string): Buffer {
  const choiceData = choice.toString() + salt;
  return Buffer.from(crypto.createHash('sha256').update(choiceData).digest());
}

/**
 * Generate a random choice
 */
function generateRandomChoice(): Choice {
  return Math.floor(Math.random() * 3) + 1 as Choice;
}

/**
 * Determine the winner between two choices
 */
function determineWinner(playerChoice: Choice, opponentChoice: Choice): 'win' | 'loss' | 'tie' {
  if (playerChoice === opponentChoice) {
    return 'tie';
  }

  if (
    (playerChoice === Choice.Rock && opponentChoice === Choice.Scissors) ||
    (playerChoice === Choice.Paper && opponentChoice === Choice.Rock) ||
    (playerChoice === Choice.Scissors && opponentChoice === Choice.Paper)
  ) {
    return 'win';
  }

  return 'loss';
}

/**
 * Benchmark commitment hash generation
 */
async function benchmarkCommitmentHash(): Promise<{
  averageTimeMs: number;
  operationsPerSecond: number;
  totalTimeMs: number;
  iterations: number;
}> {
  const iterations = 1000;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    const choice = generateRandomChoice();
    const salt = generateRandomSalt();
    calculateCommitmentHash(choice, salt);
  }

  const totalTimeMs = Date.now() - startTime;
  const averageTimeMs = totalTimeMs / iterations;
  const operationsPerSecond = Math.floor(1000 / averageTimeMs);

  return {
    averageTimeMs,
    operationsPerSecond,
    totalTimeMs,
    iterations
  };
}

/**
 * Benchmark game state transitions
 */
async function benchmarkStateTransition(): Promise<{
  averageTimeMs: number;
  operationsPerSecond: number;
  totalTimeMs: number;
  iterations: number;
}> {
  const iterations = 1000;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Mock game state
    const gameState = {
      gameId: `game-${i}`,
      players: [
        { id: 'player1', committed: false, revealed: false },
        { id: 'player2', committed: false, revealed: false }
      ],
      state: 'WaitingForPlayers',
      commitments: {},
      choices: {},
      results: {}
    };

    // Simulate state transitions

    // 1. Waiting -> Commit phase
    gameState.state = 'CommitPhase';

    // 2. Players commit
    for (const player of gameState.players) {
      player.committed = true;
      const choice = generateRandomChoice();
      const salt = generateRandomSalt();
      gameState.commitments[player.id] = calculateCommitmentHash(choice, salt).toString('hex');
    }

    // 3. Commit -> Reveal phase
    gameState.state = 'RevealPhase';

    // 4. Players reveal
    for (const player of gameState.players) {
      player.revealed = true;
      const choice = generateRandomChoice();
      gameState.choices[player.id] = choice;
    }

    // 5. Calculate results
    for (let i = 0; i < gameState.players.length; i++) {
      for (let j = i + 1; j < gameState.players.length; j++) {
        const player1 = gameState.players[i];
        const player2 = gameState.players[j];

        const player1Choice = gameState.choices[player1.id];
        const player2Choice = gameState.choices[player2.id];

        const result = determineWinner(player1Choice, player2Choice);
        gameState.results[`${player1.id}_vs_${player2.id}`] = result;
      }
    }

    // 6. Finish game
    gameState.state = 'Finished';
  }

  const totalTimeMs = Date.now() - startTime;
  const averageTimeMs = totalTimeMs / iterations;
  const operationsPerSecond = Math.floor(1000 / averageTimeMs);

  return {
    averageTimeMs,
    operationsPerSecond,
    totalTimeMs,
    iterations
  };
}

/**
 * Benchmark a complete multi-player game cycle
 */
async function benchmarkMultiPlayerGame(): Promise<{
  averageTimeMs: number;
  operationsPerSecond: number;
  totalTimeMs: number;
  iterations: number;
}> {
  const iterations = 100;
  const playersPerGame = 3;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Create game
    const gameState = {
      gameId: `game-${i}`,
      players: Array.from({ length: playersPerGame }, (_, idx) => ({
        id: `player${idx + 1}-${i}`,
        committed: false,
        revealed: false,
        choice: generateRandomChoice(),
        salt: generateRandomSalt()
      })),
      state: 'WaitingForPlayers',
      commitments: {},
      choices: {},
      results: {},
      winner: null
    };

    // Players join
    gameState.state = 'CommitPhase';

    // Players commit choices
    for (const player of gameState.players) {
      player.committed = true;
      gameState.commitments[player.id] = calculateCommitmentHash(player.choice, player.salt).toString('hex');
    }

    // Transition to reveal phase
    gameState.state = 'RevealPhase';

    // Players reveal choices
    for (const player of gameState.players) {
      player.revealed = true;
      gameState.choices[player.id] = player.choice;
    }

    // Calculate results for all player pairs
    const playerScores = {};
    gameState.players.forEach(player => playerScores[player.id] = 0);

    // Compare each player against every other player
    for (let i = 0; i < gameState.players.length; i++) {
      for (let j = i + 1; j < gameState.players.length; j++) {
        const player1 = gameState.players[i];
        const player2 = gameState.players[j];

        const player1Choice = player1.choice;
        const player2Choice = player2.choice;

        const result = determineWinner(player1Choice, player2Choice);
        gameState.results[`${player1.id}_vs_${player2.id}`] = result;

        if (result === 'win') {
          playerScores[player1.id]++;
        } else if (result === 'loss') {
          playerScores[player2.id]++;
        }
        // Ties don't affect scores
      }
    }

    // Determine the winner
    let highestScore = -1;
    let winningPlayer = null;

    for (const [playerId, score] of Object.entries(playerScores)) {
      if (score > highestScore) {
        highestScore = score as number;
        winningPlayer = playerId;
      }
    }

    gameState.winner = winningPlayer;
    gameState.state = 'Finished';
  }

  const totalTimeMs = Date.now() - startTime;
  const averageTimeMs = totalTimeMs / iterations;
  const operationsPerSecond = Math.floor(1000 / averageTimeMs);

  return {
    averageTimeMs,
    operationsPerSecond,
    totalTimeMs,
    iterations
  };
}

/**
 * Benchmark multiple concurrent games
 */
async function benchmarkConcurrentGames(): Promise<{
  averageTimeMs: number;
  operationsPerSecond: number;
  totalTimeMs: number;
  iterations: number;
  concurrentGames: number;
}> {
  const iterations = 10;
  const concurrentGames = 5;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Run multiple games concurrently
    const gamePromises = [];

    for (let j = 0; j < concurrentGames; j++) {
      gamePromises.push(simulateGame(`game-${i}-${j}`));
    }

    // Wait for all games to complete
    await Promise.all(gamePromises);
  }

  const totalTimeMs = Date.now() - startTime;
  const averageTimeMs = totalTimeMs / (iterations * concurrentGames);
  const operationsPerSecond = Math.floor(1000 / averageTimeMs);

  return {
    averageTimeMs,
    operationsPerSecond,
    totalTimeMs,
    iterations,
    concurrentGames
  };
}

/**
 * Simulate a complete game
 */
async function simulateGame(gameId: string): Promise<void> {
  return new Promise((resolve) => {
    // Simulate some async processing
    setTimeout(() => {
      // Create game
      const gameState = {
        gameId,
        players: [
          { id: `player1-${gameId}`, choice: generateRandomChoice(), salt: generateRandomSalt() },
          { id: `player2-${gameId}`, choice: generateRandomChoice(), salt: generateRandomSalt() }
        ],
        winner: null
      };

      // Calculate winner
      const player1Choice = gameState.players[0].choice;
      const player2Choice = gameState.players[1].choice;

      const result = determineWinner(player1Choice, player2Choice);

      if (result === 'win') {
        gameState.winner = gameState.players[0].id;
      } else if (result === 'loss') {
        gameState.winner = gameState.players[1].id;
      } else {
        gameState.winner = 'tie';
      }

      resolve();
    }, 10); // Simulate 10ms of processing time
  });
}

/**
 * Benchmark choice verification
 */
async function benchmarkChoiceVerification(): Promise<{
  averageTimeMs: number;
  operationsPerSecond: number;
  totalTimeMs: number;
  iterations: number;
}> {
  const iterations = 1000;

  // Pre-generate choices, salts and commitments
  const testData = [];

  for (let i = 0; i < iterations; i++) {
    const choice = generateRandomChoice();
    const salt = generateRandomSalt();
    const commitment = calculateCommitmentHash(choice, salt);

    testData.push({ choice, salt, commitment });
  }

  // Time the verification process
  const startTime = Date.now();

  for (const { choice, salt, commitment } of testData) {
    // Verify the commitment matches the choice and salt
    const verificationHash = calculateCommitmentHash(choice, salt);
    const isValid = verificationHash.equals(commitment);

    if (!isValid) {
      throw new Error('Choice verification failed');
    }
  }

  const totalTimeMs = Date.now() - startTime;
  const averageTimeMs = totalTimeMs / iterations;
  const operationsPerSecond = Math.floor(1000 / averageTimeMs);

  return {
    averageTimeMs,
    operationsPerSecond,
    totalTimeMs,
    iterations
  };
}

/**
 * Run performance benchmarks
 */
async function main() {
  console.log(chalk.blue('Running performance benchmarks...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Benchmark results
    const results = [];

    // Run each benchmark
    for (const test of PERFORMANCE_TESTS) {
      console.log(chalk.yellow(`\n=== Running benchmark: ${test.name} ===`));
      console.log(test.description);
      console.log(`Iterations: ${test.iterations}`);

      try {
        // Run the benchmark
        const benchmarkResult = await test.run();

        console.log(`\nResults:`);
        console.log(`Average time per operation: ${benchmarkResult.averageTimeMs.toFixed(4)} ms`);
        console.log(`Operations per second: ${benchmarkResult.operationsPerSecond}`);
        console.log(`Total time: ${benchmarkResult.totalTimeMs} ms`);

        results.push({
          name: test.name,
          description: test.description,
          iterations: benchmarkResult.iterations,
          concurrentGames: benchmarkResult.concurrentGames || 1,
          averageTimeMs: benchmarkResult.averageTimeMs,
          operationsPerSecond: benchmarkResult.operationsPerSecond,
          totalTimeMs: benchmarkResult.totalTimeMs
        });
      } catch (error) {
        console.error(chalk.red(`Error running benchmark "${test.name}":`), error);
        results.push({
          name: test.name,
          description: test.description,
          error: error.message
        });
      }
    }

    // Save results to file
    const resultsPath = path.join(resultsDir, 'performance-benchmark-results.json');
    await fs.writeJson(resultsPath, {
      testDate: new Date().toISOString(),
      environment: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      results
    }, { spaces: 2 });

    console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

    // Print summary
    console.log(chalk.yellow('\n====== PERFORMANCE BENCHMARK SUMMARY ======\n'));

    results.forEach(result => {
      if (result.error) {
        console.log(chalk.red(`${result.name}: Failed - ${result.error}`));
      } else {
        console.log(`${result.name}: ${result.operationsPerSecond} ops/sec (${result.averageTimeMs.toFixed(4)} ms/op)`);
      }
    });

  } catch (error) {
    console.error(chalk.red('Error running performance benchmarks:'), error);
    process.exit(1);
  }
}

// Run the benchmarks
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
