import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { Choice, GameState } from '../types';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'New Player First Game',
    description: 'Tests the experience for a new player joining their first game',
    steps: ['createGame', 'joinGame', 'commitChoices', 'revealChoices', 'checkResults']
  },
  {
    name: 'Returning Player',
    description: 'Tests the experience for a returning player creating and completing multiple games',
    steps: ['createGame', 'joinGame', 'commitChoices', 'revealChoices', 'createSecondGame', 'joinSecondGame', 'commitChoicesAgain', 'revealChoicesAgain']
  },
  {
    name: 'Timeout Handling',
    description: 'Tests the timeout handling when a player does not reveal their choice',
    steps: ['createGame', 'joinGame', 'commitChoices', 'skipReveal']
  }
];

/**
 * Format elapsed time in a readable format
 */
function formatElapsedTime(startTime: number): string {
  const elapsed = Date.now() - startTime;
  return `${(elapsed / 1000).toFixed(2)}s`;
}

/**
 * Simulate a step execution with a random delay and success probability
 */
async function simulateStep(step: string, delay: number = 500, successProbability: number = 0.95): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simulate random success/failure based on given probability
      const success = Math.random() < successProbability;
      resolve(success);
    }, delay);
  });
}

/**
 * Run mock user experience tests
 */
async function main() {
  console.log(chalk.blue('Running mock user experience tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Track test results
    const testResults = [];

    // Run each test scenario
    for (const scenario of TEST_SCENARIOS) {
      console.log(chalk.yellow(`\n=== Testing Scenario: ${scenario.name} ===`));
      console.log(scenario.description);

      const scenarioStartTime = Date.now();
      const stepResults = [];

      // Execute each step in the scenario
      for (const step of scenario.steps) {
        console.log(`\nExecuting step: ${step}`);
        const stepStartTime = Date.now();

        try {
          // Simulate step execution
          const randomDelay = Math.floor(Math.random() * 1000) + 500; // Random delay between 500ms and 1500ms
          const success = await simulateStep(step, randomDelay);

          if (success) {
            console.log(`${step} completed successfully`);
            stepResults.push({
              step,
              success: true,
              elapsed: formatElapsedTime(stepStartTime),
              details: { mockStep: true }
            });
          } else {
            console.log(chalk.red(`${step} failed`));
            stepResults.push({
              step,
              success: false,
              elapsed: formatElapsedTime(stepStartTime),
              details: { error: 'Mock step failure' }
            });
          }
        } catch (error) {
          console.error(chalk.red(`Error executing step ${step}:`), error);
          stepResults.push({
            step,
            success: false,
            elapsed: formatElapsedTime(stepStartTime),
            details: { error: error.message || 'Unknown error' }
          });
        }
      }

      // Calculate scenario results
      const successfulSteps = stepResults.filter(r => r.success).length;
      const totalSteps = stepResults.length;
      const scenarioSuccess = successfulSteps === totalSteps;
      const totalElapsedMs = Date.now() - scenarioStartTime;

      testResults.push({
        scenario: scenario.name,
        success: scenarioSuccess,
        successRate: `${(successfulSteps / totalSteps * 100).toFixed(1)}%`,
        elapsedMs: totalElapsedMs,
        elapsedFormatted: `${(totalElapsedMs / 1000).toFixed(2)}s`,
        steps: stepResults
      });

      if (scenarioSuccess) {
        console.log(chalk.green(`\n✓ Scenario "${scenario.name}" completed successfully in ${(totalElapsedMs / 1000).toFixed(2)}s`));
      } else {
        console.log(chalk.red(`\n✗ Scenario "${scenario.name}" completed with errors (${successfulSteps}/${totalSteps} steps passed)`));
      }

      // Wait between scenarios
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save test results to file
    const resultsPath = path.join(resultsDir, 'mock-ux-test-results.json');
    await fs.writeJson(resultsPath, testResults, { spaces: 2 });

    console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

    // Calculate overall stats
    const totalScenarios = testResults.length;
    const successfulScenarios = testResults.filter(r => r.success).length;
    const averageTimeMs = testResults.reduce((sum, r) => sum + r.elapsedMs, 0) / totalScenarios;

    console.log(chalk.yellow('\nUser Experience Test Summary:'));
    console.log(`Scenarios Tested: ${totalScenarios}`);
    console.log(`Successful Scenarios: ${successfulScenarios} (${(successfulScenarios / totalScenarios * 100).toFixed(0)}%)`);
    console.log(`Average Scenario Time: ${(averageTimeMs / 1000).toFixed(2)}s`);

    if (successfulScenarios === totalScenarios) {
      console.log(chalk.green('\n✓ All user experience scenarios passed!'));
    } else {
      console.log(chalk.yellow(`\nⓘ ${totalScenarios - successfulScenarios} scenarios failed.`));
    }

  } catch (error) {
    console.error(chalk.red('Error running mock user experience tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
