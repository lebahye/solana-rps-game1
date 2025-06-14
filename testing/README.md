# Solana Rock Paper Scissors Game Testing Framework

This directory contains a comprehensive testing suite for the Solana-based Rock Paper Scissors game. The tests cover various aspects of the game's functionality, security, and performance.

## Testing Areas

The testing suite covers the following key areas:

1. **Basic Functionality** - Verifies the basic functionality of the game, including game creation, player joining, move commitment, and result calculation.
2. **Security** - Tests the security aspects of the game to identify potential vulnerabilities.
3. **Performance** - Benchmarks critical operations to ensure the game performs well under different loads.
4. **Fairness** - Verifies that the game outcomes are fair and cannot be manipulated.
5. **User Experience** - Tests the user experience flow to ensure a smooth gameplay experience.
6. **End-to-End Integration** - Tests the complete game flow with simulated blockchain interactions.

## Testing Structure

The testing directory is organized as follows:

- `scripts/` - Contains all test scripts
- `results/` - Contains test results in JSON format
- `wallets/` - Contains test wallet keypairs for testing
- `utils/` - Utility functions for testing
- `types/` - TypeScript type definitions
- `dashboard/` - Test results visualization

## Running Tests

### Prerequisites

- Node.js 16+
- npm or Bun

### Setup

```bash
cd testing
npm install
```

### Generate Test Wallets

```bash
npm run generate-wallets
```

This will create test wallets in the `wallets/` directory.

### Fund Test Wallets (Optional)

To fund test wallets using the Solana devnet faucet:

```bash
npm run fund-wallets
```

> Note: This may be subject to rate limiting by the Solana devnet faucet.

### Run Tests

#### Basic Tests

```bash
npm run test-basic
```

#### Security Tests

```bash
npm run test-mock-security
```

#### Performance Tests

```bash
npm run test-performance
```

#### E2E Integration Tests

```bash
npm run test-e2e
```

#### Run All Mock Tests

```bash
npm run run-all-mock-tests
```

#### Run Comprehensive Test Suite

```bash
npm run test-comprehensive
```

### Generate Dashboard

After running tests, you can generate a visual dashboard of the test results:

```bash
npm run generate-dashboard
```

The dashboard will be available at `dashboard/index.html`.

### Run Tests and Generate Dashboard

```bash
npm run run-tests-and-dashboard
```

## Test Types

### Basic Tests

Verifies the basic functionality of the mock game environment, including wallet structure and Solana connection.

### Security Tests

Tests for various security vulnerabilities, including:

1. **Commitment Hash Strength** - Tests the strength of the commitment hash function to prevent choice inference.
2. **Salt Randomness** - Verifies that the generated salts have sufficient entropy.
3. **Frontrunning Protection** - Tests if the game is protected against frontrunning attacks.
4. **Double Spending** - Tests protection against double spending and duplicate participation.
5. **Timeout Manipulation** - Tests if the game is protected against timeout manipulation.
6. **Transaction Replay** - Tests protection against transaction replay attacks.
7. **Commitment Revelation Analysis** - Tests if player choice can be inferred from commitment revelation patterns.
8. **Cryptographic Timing Attack** - Tests resistance to timing attacks on cryptographic operations.

### Performance Tests

Benchmarks critical operations, including:

1. **Commitment Generation** - Measures the speed of generating commitments.
2. **Commitment Verification** - Measures the speed of verifying commitments.
3. **Game State Calculation** - Measures the speed of calculating game state.

### Fairness Tests

Verifies that the game outcomes are fair, by:

1. **Outcome Distribution** - Tests the distribution of game outcomes.
2. **Statistical Fairness** - Tests statistical properties of the game outcomes.

### E2E Integration Tests

Tests the complete game flow, including:

1. **Game Creation** - Tests creating a new game.
2. **Player Joining** - Tests players joining a game.
3. **Commitment Phase** - Tests the commitment phase of the game.
4. **Revelation Phase** - Tests the revelation phase of the game.
5. **Result Calculation** - Tests the result calculation.
6. **Reward Distribution** - Tests the reward distribution.

## Continuous Integration

The project includes GitHub Actions workflows for continuous testing. The workflows are defined in `.github/workflows/test.yml`.

To run tests in CI, push to the `main` or `master` branch, or create a pull request against these branches. The CI will run the comprehensive test suite.

You can also manually trigger the CI workflow from the GitHub Actions tab and select which tests to run.

## Security Considerations

The test suite includes mock security tests that have identified some potential security concerns:

1. **Commitment Hash Strength** - The original commitment hash function was identified as potentially vulnerable. We've improved it by using HMAC-SHA512 instead of SHA256 and increased the salt size.

## Test Dashboard

The testing framework includes a visual dashboard that displays test results in an easy-to-understand format. To view the dashboard:

1. Run the tests with `npm run run-all-mock-tests`
2. Generate the dashboard with `npm run generate-dashboard`
3. Open `dashboard/index.html` in a web browser

The dashboard provides:
- Overall test pass rates
- Test counts by category
- Detailed security test results
- Performance benchmarks
- Trend visualization

## Future Improvements

Planned improvements to the testing framework include:

1. **Real Blockchain Testing** - Run tests on the actual Solana blockchain (testnet or devnet) once funding issues are resolved.
2. **Expanded Security Tests** - Add additional security tests for more attack vectors.
3. **Performance Under Load** - Test the game under high load conditions.
4. **Regression Testing** - Implement regression tests to catch regressions in future updates.
5. **Fuzz Testing** - Implement fuzz testing to find edge cases.

## License

This testing framework is part of the Solana RPS Game project and is subject to the same license terms.
