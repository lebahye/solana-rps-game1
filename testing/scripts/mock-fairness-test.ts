import { analyzeFairness, printFairnessResults, saveFairnessResults } from '../utils/game-analyzer';
import { Choice, GameOutcome } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

/**
 * Generate a random choice (Rock, Paper, or Scissors)
 */
function generateRandomChoice(): Choice {
  return Math.floor(Math.random() * 3) + 1 as Choice;
}

/**
 * Determine the outcome of a game
 */
function determineOutcome(playerChoice: Choice, opponentChoice: Choice): GameOutcome {
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
 * Run fairness tests using mock games
 */
async function main() {
  console.log(chalk.blue('Running mock fairness tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Game outcomes storage
    const gameResults: {
      playerChoice: Choice;
      opponentChoice: Choice;
      result: GameOutcome;
    }[] = [];

    // Run a specified number of mock fairness tests
    const testCount = 1000; // More tests for better statistical significance
    console.log(`Running ${testCount} mock fairness tests...`);

    for (let i = 0; i < testCount; i++) {
      try {
        // Generate random choices for players
        const hostChoice = generateRandomChoice();
        const player1Choice = generateRandomChoice();

        // Determine game outcome
        const result = determineOutcome(hostChoice, player1Choice);

        // Store the result
        gameResults.push({
          playerChoice: hostChoice,
          opponentChoice: player1Choice,
          result
        });

        if (i % 100 === 0 && i > 0) {
          console.log(`Completed ${i} tests`);
        }
      } catch (error) {
        console.error(chalk.red(`Error in test ${i + 1}:`), error);
      }
    }

    // Analyze results
    console.log(chalk.yellow('\nAnalyzing fairness of game outcomes...\n'));
    const fairnessResults = analyzeFairness(gameResults);

    // Print and save results
    printFairnessResults(fairnessResults);

    const resultsPath = path.join(resultsDir, 'mock-fairness-results.json');
    saveFairnessResults(fairnessResults, resultsPath);

    console.log(chalk.green(`Results saved to: ${resultsPath}`));
  } catch (error) {
    console.error(chalk.red('Error running mock fairness tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
