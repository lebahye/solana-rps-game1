import { Choice, FairnessResult, GameOutcome } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Determine the winner between two choices
 */
export function determineWinner(playerChoice: Choice, opponentChoice: Choice): GameOutcome {
  if (playerChoice === opponentChoice) {
    return 'tie';
  }

  // Rock(1) beats Scissors(3)
  // Paper(2) beats Rock(1)
  // Scissors(3) beats Paper(2)
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
 * Analyze game outcomes for fairness
 */
export function analyzeFairness(games: { playerChoice: Choice, opponentChoice: Choice, result: GameOutcome }[]): FairnessResult {
  // Count outcomes
  let rockWins = 0;
  let paperWins = 0;
  let scissorsWins = 0;
  let ties = 0;

  // Verify each game result is correct
  games.forEach(game => {
    const expectedResult = determineWinner(game.playerChoice, game.opponentChoice);

    if (game.result !== expectedResult) {
      console.error(`Incorrect game result: Expected ${expectedResult}, got ${game.result}`);
      throw new Error('Game result validation failed');
    }

    // Count wins by choice
    if (game.result === 'win') {
      if (game.playerChoice === Choice.Rock) rockWins++;
      if (game.playerChoice === Choice.Paper) paperWins++;
      if (game.playerChoice === Choice.Scissors) scissorsWins++;
    } else if (game.result === 'tie') {
      ties++;
    }
  });

  const totalGames = games.length;
  const winningGames = totalGames - ties;

  // Calculate percentages
  const rockWinPercentage = winningGames > 0 ? (rockWins / winningGames) * 100 : 0;
  const paperWinPercentage = winningGames > 0 ? (paperWins / winningGames) * 100 : 0;
  const scissorsWinPercentage = winningGames > 0 ? (scissorsWins / winningGames) * 100 : 0;
  const tiePercentage = totalGames > 0 ? (ties / totalGames) * 100 : 0;

  // Calculate variance (how far from perfect distribution of 33.33% each)
  const perfectDistribution = 33.33;
  const rockVariance = Math.abs(rockWinPercentage - perfectDistribution);
  const paperVariance = Math.abs(paperWinPercentage - perfectDistribution);
  const scissorsVariance = Math.abs(scissorsWinPercentage - perfectDistribution);

  const maxVariance = Math.max(rockVariance, paperVariance, scissorsVariance);

  // Consider it fair if variance is less than 10% (an arbitrary threshold)
  const isBalanced = maxVariance < 10.0;

  return {
    totalGames,
    rockWins,
    paperWins,
    scissorsWins,
    ties,
    rockWinPercentage,
    paperWinPercentage,
    scissorsWinPercentage,
    tiePercentage,
    isBalanced,
    maxVariance
  };
}

/**
 * Save fairness results to file
 */
export function saveFairnessResults(results: FairnessResult, outputPath: string): void {
  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeJsonSync(outputPath, results, { spaces: 2 });
}

/**
 * Print fairness results
 */
export function printFairnessResults(results: FairnessResult): void {
  console.log('\n====== FAIRNESS TEST RESULTS ======\n');
  console.log(`Total Games: ${results.totalGames}`);
  console.log(`Ties: ${results.ties} (${results.tiePercentage.toFixed(2)}%)`);
  console.log('\nWin Distribution:');
  console.log(`Rock Wins: ${results.rockWins} (${results.rockWinPercentage.toFixed(2)}%)`);
  console.log(`Paper Wins: ${results.paperWins} (${results.paperWinPercentage.toFixed(2)}%)`);
  console.log(`Scissors Wins: ${results.scissorsWins} (${results.scissorsWinPercentage.toFixed(2)}%)`);
  console.log(`\nMaximum Variance: ${results.maxVariance.toFixed(2)}%`);

  if (results.isBalanced) {
    console.log(chalk.green('\n✓ Game outcomes are fairly distributed'));
  } else {
    console.log(chalk.red('\n✗ Game outcomes show significant bias'));
  }
  console.log('\n==================================\n');
}

/**
 * Analyze fee correctness
 */
export function analyzeFees(
  transactionData: any[],
  expectedFeePercentage: number
): {
  totalWagered: number;
  totalFees: number;
  actualFeePercentage: number;
  isCorrect: boolean;
  differencePercentage: number;
} {
  let totalWagered = 0;
  let totalFees = 0;

  // Calculate total wagered and fees
  transactionData.forEach(tx => {
    if (tx.feeChange && tx.feeChange > 0) {
      totalWagered += tx.feeChange;
      totalFees += tx.fee;
    }
  });

  const actualFeePercentage = (totalFees / totalWagered) * 100;
  const differencePercentage = Math.abs(actualFeePercentage - (expectedFeePercentage * 100));

  // Consider it correct if within 0.05% of expected (accounting for rounding, etc.)
  const isCorrect = differencePercentage < 0.05;

  return {
    totalWagered,
    totalFees,
    actualFeePercentage,
    isCorrect,
    differencePercentage
  };
}

/**
 * Print fee analysis results
 */
export function printFeeAnalysis(
  analysis: {
    totalWagered: number;
    totalFees: number;
    actualFeePercentage: number;
    isCorrect: boolean;
    differencePercentage: number;
  },
  expectedFeePercentage: number
): void {
  console.log('\n====== FEE ANALYSIS RESULTS ======\n');
  console.log(`Total Wagered: ${analysis.totalWagered.toFixed(6)} SOL`);
  console.log(`Total Fees: ${analysis.totalFees.toFixed(6)} SOL`);
  console.log(`\nExpected Fee Percentage: ${(expectedFeePercentage * 100).toFixed(2)}%`);
  console.log(`Actual Fee Percentage: ${analysis.actualFeePercentage.toFixed(6)}%`);
  console.log(`Difference: ${analysis.differencePercentage.toFixed(6)}%`);

  if (analysis.isCorrect) {
    console.log(chalk.green('\n✓ Fee calculation is correct'));
  } else {
    console.log(chalk.red('\n✗ Fee calculation differs from expected'));
  }
  console.log('\n==================================\n');
}
