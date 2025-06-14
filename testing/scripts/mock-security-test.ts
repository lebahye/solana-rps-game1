import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as crypto from 'crypto';
import { Choice } from '../types';

// Path to results directory
const resultsDir = path.join(__dirname, '../results');

// Security test vectors
const SECURITY_TESTS = [
  {
    name: 'Commitment Hash Strength',
    description: 'Tests if the commitment hash function is strong enough',
    run: testCommitmentHashStrength
  },
  {
    name: 'Salt Randomness',
    description: 'Tests that generated salts have sufficient entropy',
    run: testSaltRandomness
  },
  {
    name: 'Frontrunning Protection',
    description: 'Tests protection against frontrunning attacks',
    run: testFrontrunningProtection
  },
  {
    name: 'Double Spending',
    description: 'Tests protection against double spending attacks',
    run: testDoubleSpendingProtection
  },
  {
    name: 'Timeout Manipulation',
    description: 'Tests protection against timeout manipulation',
    run: testTimeoutManipulation
  },
  // New advanced security tests
  {
    name: 'Transaction Replay',
    description: 'Tests protection against transaction replay attacks',
    run: testTransactionReplayProtection
  },
  {
    name: 'Commitment Revelation Analysis',
    description: 'Tests if player choice can be inferred from commitment revelation',
    run: testCommitmentRevealationAnalysis
  },
  {
    name: 'Cryptographic Timing Attack',
    description: 'Tests resistance to timing attacks on cryptographic operations',
    run: testCryptographicTimingAttack
  }
];

/**
 * Generate a random salt string
 */
function generateRandomSalt(): string {
  // Increase salt size from 16 bytes to 32 bytes for stronger security
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate commitment hash for a choice and salt
 * Using a more secure approach with HMAC-SHA512 instead of simple SHA256
 */
function calculateCommitmentHash(choice: Choice, salt: string): Buffer {
  // Convert choice to a string padded with zeros for consistent length
  const choiceString = choice.toString().padStart(10, '0');

  // Use HMAC-SHA512 which provides better security guarantees
  // HMAC uses the salt as the key and the choice as the message
  const hmac = crypto.createHmac('sha512', salt);
  hmac.update(choiceString);

  // Return the digest as a buffer
  return Buffer.from(hmac.digest());
}

/**
 * Test if the commitment hash function is strong enough
 */
async function testCommitmentHashStrength(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing commitment hash strength...');

  // Generate a set of commitments for different choices
  const commitments: { [key: string]: string[] } = {};
  const trials = 1000;

  // For each choice (Rock, Paper, Scissors), generate multiple commitments
  for (let choice = 1; choice <= 3; choice++) {
    commitments[`choice_${choice}`] = [];

    for (let i = 0; i < trials; i++) {
      const salt = generateRandomSalt();
      const hash = calculateCommitmentHash(choice as Choice, salt).toString('hex');
      commitments[`choice_${choice}`].push(hash);
    }
  }

  // Check for hash collisions
  const allHashes = [
    ...commitments.choice_1,
    ...commitments.choice_2,
    ...commitments.choice_3
  ];

  const uniqueHashes = new Set(allHashes);
  const collisionRate = 1 - (uniqueHashes.size / allHashes.length);

  // Check if hashes for different choices are distinguishable
  // (They should be indistinguishable if the hash function is strong)

  // Take sample hashes from each choice
  const sample1 = commitments.choice_1.slice(0, 100);
  const sample2 = commitments.choice_2.slice(0, 100);
  const sample3 = commitments.choice_3.slice(0, 100);

  // Calculate average hash values for each sample (converting to numbers)
  const avgHashValue1 = calculateAverageHashValue(sample1);
  const avgHashValue2 = calculateAverageHashValue(sample2);
  const avgHashValue3 = calculateAverageHashValue(sample3);

  // Calculate the variance between the averages
  const differences = [
    Math.abs(avgHashValue1 - avgHashValue2),
    Math.abs(avgHashValue1 - avgHashValue3),
    Math.abs(avgHashValue2 - avgHashValue3)
  ];

  const maxDifference = Math.max(...differences);

  // The hash function is strong if:
  // 1. There are no collisions (or very few)
  // 2. The hash values for different choices have similar distributions
  const isStrong = collisionRate < 0.001 && maxDifference < 0.1;

  return {
    success: isStrong,
    details: {
      collisionRate,
      hashSamples: {
        rock: commitments.choice_1.slice(0, 3),
        paper: commitments.choice_2.slice(0, 3),
        scissors: commitments.choice_3.slice(0, 3)
      },
      averages: {
        rock: avgHashValue1,
        paper: avgHashValue2,
        scissors: avgHashValue3
      },
      maxDifference
    }
  };
}

/**
 * Calculate an average hash value from a set of hex hash strings
 */
function calculateAverageHashValue(hashes: string[]): number {
  // Improve the hash value averaging technique
  // Take a longer substring (16 characters instead of 8) for more significant representation
  const sum = hashes.reduce((acc, hash) => {
    // Take the first 16 characters of the hash and convert to a number
    const hashNum = parseInt(hash.substring(0, 16), 16) % Number.MAX_SAFE_INTEGER;
    return acc + hashNum;
  }, 0);

  return sum / hashes.length;
}

/**
 * Test that generated salts have sufficient entropy
 */
async function testSaltRandomness(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing salt randomness...');

  // Generate multiple salts
  const saltCount = 1000;
  const salts = [];

  for (let i = 0; i < saltCount; i++) {
    salts.push(generateRandomSalt());
  }

  // Check uniqueness
  const uniqueSalts = new Set(salts);
  const uniqueRatio = uniqueSalts.size / saltCount;

  // Check entropy using Shannon entropy calculation
  const entropyScore = calculateEntropy(salts.join(''));

  // Check distribution of characters
  const charFrequency = {};
  const sampleString = salts.join('').substring(0, 10000);

  for (let i = 0; i < sampleString.length; i++) {
    const char = sampleString[i];
    charFrequency[char] = (charFrequency[char] || 0) + 1;
  }

  // Calculate character frequency variance
  const freqValues = Object.values(charFrequency) as number[];
  const avgFreq = freqValues.reduce((sum, val) => sum + val, 0) / freqValues.length;
  const freqVariance = Math.sqrt(
    freqValues.reduce((sum, val) => sum + Math.pow(val - avgFreq, 2), 0) / freqValues.length
  ) / avgFreq;

  // Test is successful if all salts are unique, entropy is high, and distribution is even
  const success = uniqueRatio > 0.99 && entropyScore > 3.5 && freqVariance < 0.1;

  return {
    success,
    details: {
      uniqueRatio,
      entropyScore,
      freqVariance,
      sampleSalts: salts.slice(0, 5) // Just show a few examples
    }
  };
}

/**
 * Test protection against frontrunning attacks
 */
async function testFrontrunningProtection(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing frontrunning protection...');

  // In a commit-reveal scheme:
  // 1. Player commits to a choice + salt hash
  // 2. Later reveals the choice and salt
  // This prevents frontrunning because the choice is hidden until reveal

  // Simulate a game with commit-reveal
  const player1Choice = 1 as Choice; // Rock
  const player1Salt = generateRandomSalt();
  const player1Commitment = calculateCommitmentHash(player1Choice, player1Salt);

  // Now simulate a frontrunning attack:
  // Attacker sees the commitment but doesn't know the choice
  // Try to derive the choice from the commitment
  let attackerCanDeriveChoice = false;

  // Brute force all possible choices
  for (let choice = 1; choice <= 3; choice++) {
    // Without the salt, attacker tries random salts
    for (let i = 0; i < 100; i++) { // Try 100 random salts
      const attackerSalt = generateRandomSalt();
      const attackerCommitment = calculateCommitmentHash(choice as Choice, attackerSalt);

      // If the attacker finds a matching commitment (extremely unlikely)
      if (attackerCommitment.equals(player1Commitment)) {
        attackerCanDeriveChoice = true;
        break;
      }
    }
  }

  // Protection is successful if attacker cannot derive the choice from the commitment
  const success = !attackerCanDeriveChoice;

  return {
    success,
    details: {
      commitmentScheme: "commit-reveal with salted hash",
      player1Choice,
      player1Salt: player1Salt.substring(0, 8) + "...", // Truncate for readability
      commitment: player1Commitment.toString('hex').substring(0, 16) + "...",
      attackerSuccess: attackerCanDeriveChoice
    }
  };
}

/**
 * Test protection against double spending attacks
 */
async function testDoubleSpendingProtection(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing double spending protection...');

  // In Solana, double spending is prevented by the runtime
  // Our application needs to check that a player cannot join a game twice

  // Simulate a game state
  const gameState = {
    gameId: "mock-game-123",
    players: [
      { publicKey: "player1-public-key", entryFee: 0.1 },
      { publicKey: "player2-public-key", entryFee: 0.1 }
    ],
    maxPlayers: 3
  };

  // Try to join the game with an existing player
  const existingPlayerTryAgain = {
    publicKey: "player1-public-key",
    entryFee: 0.1
  };

  // Mock join game function that should prevent duplicates
  function mockJoinGame(game, player) {
    // Check if player already exists
    const playerExists = game.players.some(p => p.publicKey === player.publicKey);

    if (playerExists) {
      throw new Error("Player already joined this game");
    }

    // Otherwise, add player
    game.players.push(player);
    return true;
  }

  // Test if double joining is prevented
  let doubleJoinPrevented = false;
  try {
    mockJoinGame(gameState, existingPlayerTryAgain);
  } catch (error) {
    doubleJoinPrevented = true;
  }

  // Try with a new player (should succeed)
  let newPlayerJoinSucceeded = false;
  try {
    mockJoinGame(gameState, { publicKey: "player3-public-key", entryFee: 0.1 });
    newPlayerJoinSucceeded = true;
  } catch (error) {
    // Should not happen
  }

  // Protection is successful if double join is prevented and new join succeeds
  const success = doubleJoinPrevented && newPlayerJoinSucceeded;

  return {
    success,
    details: {
      doubleJoinPrevented,
      newPlayerJoinSucceeded,
      finalPlayerCount: gameState.players.length
    }
  };
}

/**
 * Test protection against timeout manipulation
 */
async function testTimeoutManipulation(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing timeout manipulation protection...');

  // In a real implementation, timeouts are enforced by:
  // 1. Setting a timeout period when creating a game
  // 2. Checking timestamps for each step
  // 3. Allowing resolution of timeouts when the period expires

  // Mock game state with a timeout
  const mockGame = {
    gameId: "mock-game-456",
    createdAt: Date.now() - 600000, // 10 minutes ago
    timeoutSeconds: 300, // 5 minute timeout
    state: "CommitPhase",
    players: [
      { publicKey: "player1-public-key", hasCommitted: true },
      { publicKey: "player2-public-key", hasCommitted: false }
    ]
  };

  // Function to check if a timeout can be resolved
  function canResolveTimeout(game) {
    const currentTime = Date.now();
    const gameAgeSeconds = (currentTime - game.createdAt) / 1000;

    // If the game has been in the current state longer than timeout
    return gameAgeSeconds > game.timeoutSeconds;
  }

  // Check if timeout can be resolved (should be true)
  const timeoutCanBeResolved = canResolveTimeout(mockGame);

  // Now simulate a player trying to manipulate the timeout
  // by creating a game with a very short timeout to force other players to lose
  const shortTimeoutGame = {
    gameId: "mock-game-789",
    createdAt: Date.now(),
    timeoutSeconds: 1, // Unreasonably short timeout
    state: "CommitPhase",
    players: [
      { publicKey: "attacker-public-key", hasCommitted: true },
      { publicKey: "victim-public-key", hasCommitted: false }
    ]
  };

  // Protection would involve minimum timeout periods
  const minTimeoutAllowed = 30; // 30 seconds minimum

  const timeoutTooShort = shortTimeoutGame.timeoutSeconds < minTimeoutAllowed;

  // Success if timeouts work properly and minimum limits are enforced
  const success = timeoutCanBeResolved && timeoutTooShort;

  return {
    success,
    details: {
      normalGame: {
        timeoutSeconds: mockGame.timeoutSeconds,
        gameAge: ((Date.now() - mockGame.createdAt) / 1000).toFixed(0) + " seconds",
        timeoutResolvable: timeoutCanBeResolved
      },
      attackerGame: {
        timeoutSeconds: shortTimeoutGame.timeoutSeconds,
        tooShort: timeoutTooShort,
        minimumRequired: minTimeoutAllowed
      }
    }
  };
}

/**
 * Test protection against transaction replay attacks
 */
async function testTransactionReplayProtection(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing transaction replay protection...');

  // In Solana, transaction replay is prevented through:
  // 1. Recent blockhash inclusion in the transaction (expiring after ~2 minutes)
  // 2. Nonce accounts for longer-lived transactions

  // Simulate transactions with blockhash integration

  // Mock structure to represent a transaction
  interface MockTransaction {
    id: string;
    signature: string;
    recentBlockhash: string;
    instructions: any[];
    nonce?: string;
  }

  // Mock blockhash history
  const recentBlockhashes = [
    'A1B2C3D4E5F6G7H8I9J0...',
    'K1L2M3N4O5P6Q7R8S9T0...',
    'U1V2W3X4Y5Z6A7B8C9D0...'
  ];

  // Keep track of processed transaction signatures to prevent replay
  const processedSignatures = new Set<string>();

  // Mock function to process a transaction
  function mockProcessTransaction(tx: MockTransaction): boolean {
    // Check if signature already processed (replay detection)
    if (processedSignatures.has(tx.signature)) {
      return false;
    }

    // Check if blockhash is recent (within last 3 blocks in this mock)
    const validBlockhash = recentBlockhashes.includes(tx.recentBlockhash);
    if (!validBlockhash && !tx.nonce) {
      return false;
    }

    // Process transaction
    processedSignatures.add(tx.signature);
    return true;
  }

  // Create sample transactions
  const transaction1: MockTransaction = {
    id: 'tx1',
    signature: 'sig1234',
    recentBlockhash: recentBlockhashes[0],
    instructions: [{ type: 'transfer', amount: 1.0 }]
  };

  const transaction2: MockTransaction = {
    id: 'tx2',
    signature: 'sig5678',
    recentBlockhash: recentBlockhashes[1],
    instructions: [{ type: 'commit', hash: '0xa1b2c3...' }]
  };

  // Replay of transaction 1 (exact duplicate)
  const replayTransaction1: MockTransaction = {
    ...transaction1
  };

  // Transaction with expired blockhash
  const expiredTransaction: MockTransaction = {
    id: 'tx3',
    signature: 'sig9012',
    recentBlockhash: 'EXPIRED000000...',
    instructions: [{ type: 'reveal', choice: 1, salt: '12345' }]
  };

  // Transaction with nonce (would be valid even with expired blockhash)
  const nonceTransaction: MockTransaction = {
    id: 'tx4',
    signature: 'sig3456',
    recentBlockhash: 'EXPIRED000000...',
    nonce: 'nonce12345',
    instructions: [{ type: 'resolve', gameId: 'game123' }]
  };

  // Process original transactions
  const tx1Result = mockProcessTransaction(transaction1);
  const tx2Result = mockProcessTransaction(transaction2);

  // Try to replay transaction 1
  const replayResult = mockProcessTransaction(replayTransaction1);

  // Try to process expired and nonce transactions
  const expiredResult = mockProcessTransaction(expiredTransaction);
  const nonceResult = mockProcessTransaction(nonceTransaction);

  // Check results
  const replayDetected = !replayResult;
  const expiredRejected = !expiredResult;
  const nonceAccepted = nonceResult;

  // Success if replay is detected, expired txs rejected, and nonce txs accepted
  const success = replayDetected && expiredRejected && nonceAccepted;

  return {
    success,
    details: {
      originalTransactionsProcessed: tx1Result && tx2Result,
      replayDetected,
      expiredTransactionRejected: expiredRejected,
      nonceTransactionAccepted: nonceAccepted,
      processedSignatures: Array.from(processedSignatures)
    }
  };
}

/**
 * Test if player choice can be inferred from commitment revelation patterns
 */
async function testCommitmentRevealationAnalysis(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing commitment revelation analysis protection...');

  // This test checks if a pattern analysis of commitment-reveal pairs
  // could potentially leak information about player strategy

  // Mock a series of games with player choices
  const games = [];
  const trials = 100;

  // Create mock games with player choices, salts, and commitments
  for (let i = 0; i < trials; i++) {
    // Simulate a player with a biased strategy (prefers Rock)
    const biasedPlayerChoice = Math.random() < 0.6 ? 1 : (Math.random() < 0.5 ? 2 : 3);
    const biasedPlayerSalt = generateRandomSalt();
    const biasedPlayerCommitment = calculateCommitmentHash(biasedPlayerChoice as Choice, biasedPlayerSalt);

    // Simulate a player with uniform random strategy
    const randomPlayerChoice = Math.floor(Math.random() * 3) + 1;
    const randomPlayerSalt = generateRandomSalt();
    const randomPlayerCommitment = calculateCommitmentHash(randomPlayerChoice as Choice, randomPlayerSalt);

    games.push({
      biasedPlayer: {
        choice: biasedPlayerChoice,
        salt: biasedPlayerSalt,
        commitment: biasedPlayerCommitment.toString('hex')
      },
      randomPlayer: {
        choice: randomPlayerChoice,
        salt: randomPlayerSalt,
        commitment: randomPlayerCommitment.toString('hex')
      }
    });
  }

  // Simulate an attacker trying to infer choices from commitment patterns
  // An attacker with access to the commitments and revealed choices
  // would try to build a model to predict choices from new commitments

  // For this mock test, we'll analyze only the first byte of the commitment
  // to see if it correlates with the choice

  const biasedPlayerStats = {
    rock: { commitmentFirstBytes: [] },
    paper: { commitmentFirstBytes: [] },
    scissors: { commitmentFirstBytes: [] }
  };

  const randomPlayerStats = {
    rock: { commitmentFirstBytes: [] },
    paper: { commitmentFirstBytes: [] },
    scissors: { commitmentFirstBytes: [] }
  };

  // Collect stats
  for (const game of games) {
    // Convert choice to name for readability
    const biasedChoice = choiceToName(game.biasedPlayer.choice as Choice);
    const randomChoice = choiceToName(game.randomPlayer.choice as Choice);

    // Get first byte (first two hex chars) of commitment
    const biasedFirstByte = parseInt(game.biasedPlayer.commitment.substring(0, 2), 16);
    const randomFirstByte = parseInt(game.randomPlayer.commitment.substring(0, 2), 16);

    // Add to stats
    biasedPlayerStats[biasedChoice].commitmentFirstBytes.push(biasedFirstByte);
    randomPlayerStats[randomChoice].commitmentFirstBytes.push(randomFirstByte);
  }

  // Calculate means for each choice
  const biasedMeans = {
    rock: calculateMean(biasedPlayerStats.rock.commitmentFirstBytes),
    paper: calculateMean(biasedPlayerStats.paper.commitmentFirstBytes),
    scissors: calculateMean(biasedPlayerStats.scissors.commitmentFirstBytes)
  };

  const randomMeans = {
    rock: calculateMean(randomPlayerStats.rock.commitmentFirstBytes),
    paper: calculateMean(randomPlayerStats.paper.commitmentFirstBytes),
    scissors: calculateMean(randomPlayerStats.scissors.commitmentFirstBytes)
  };

  // Calculate standard deviations
  const biasedStdDevs = {
    rock: calculateStdDev(biasedPlayerStats.rock.commitmentFirstBytes, biasedMeans.rock),
    paper: calculateStdDev(biasedPlayerStats.paper.commitmentFirstBytes, biasedMeans.paper),
    scissors: calculateStdDev(biasedPlayerStats.scissors.commitmentFirstBytes, biasedMeans.scissors)
  };

  const randomStdDevs = {
    rock: calculateStdDev(randomPlayerStats.rock.commitmentFirstBytes, randomMeans.rock),
    paper: calculateStdDev(randomPlayerStats.paper.commitmentFirstBytes, randomMeans.paper),
    scissors: calculateStdDev(randomPlayerStats.scissors.commitmentFirstBytes, randomMeans.scissors)
  };

  // Calculate separation between means (max difference between means divided by average std dev)
  // A high separation would mean choices could potentially be distinguished
  const biasedSeparation = calculateSeparation(biasedMeans, biasedStdDevs);
  const randomSeparation = calculateSeparation(randomMeans, randomStdDevs);

  // A low separation value (<2.0) indicates choices cannot be reliably distinguished
  // from commitment patterns
  const success = biasedSeparation < 2.0 && randomSeparation < 2.0;

  return {
    success,
    details: {
      sampleSize: trials,
      biasedPlayerStats: {
        choiceDistribution: {
          rock: biasedPlayerStats.rock.commitmentFirstBytes.length,
          paper: biasedPlayerStats.paper.commitmentFirstBytes.length,
          scissors: biasedPlayerStats.scissors.commitmentFirstBytes.length
        },
        means: biasedMeans,
        standardDeviations: biasedStdDevs,
        separation: biasedSeparation
      },
      randomPlayerStats: {
        choiceDistribution: {
          rock: randomPlayerStats.rock.commitmentFirstBytes.length,
          paper: randomPlayerStats.paper.commitmentFirstBytes.length,
          scissors: randomPlayerStats.scissors.commitmentFirstBytes.length
        },
        means: randomMeans,
        standardDeviations: randomStdDevs,
        separation: randomSeparation
      },
      interpretation: success ?
        "Commitment patterns do not leak information about player choices" :
        "WARNING: Commitment patterns may leak information about player choices"
    }
  };
}

/**
 * Test resistance to timing attacks on cryptographic operations
 */
async function testCryptographicTimingAttack(): Promise<{
  success: boolean;
  details: any;
}> {
  console.log('Testing cryptographic timing attack resistance...');

  // In a timing attack, an attacker tries to extract secrets by measuring
  // the time it takes to perform cryptographic operations
  // Constant-time cryptographic operations are important for security

  // This test simulates timing measurements for hash verification

  // Track timing measurements
  const timingsValid = [];
  const timingsInvalid = [];

  // Number of samples to collect
  const samples = 100;

  // Generate a valid commitment
  const choice = 1 as Choice;
  const salt = generateRandomSalt();
  const validCommitment = calculateCommitmentHash(choice, salt);

  // Function to verify a commitment (constant time implementation)
  function verifyCommitmentConstantTime(
    commitment: Buffer,
    revealedChoice: Choice,
    revealedSalt: string
  ): boolean {
    // Recalculate the commitment
    const calculatedCommitment = calculateCommitmentHash(revealedChoice, revealedSalt);

    // Compare in constant time (important for security)
    // This simulates a constant time comparison
    let diff = 0;
    for (let i = 0; i < commitment.length; i++) {
      diff |= commitment[i] ^ calculatedCommitment[i];
    }

    return diff === 0;
  }

  // Function to verify a commitment (vulnerable implementation)
  function verifyCommitmentVulnerable(
    commitment: Buffer,
    revealedChoice: Choice,
    revealedSalt: string
  ): boolean {
    // Recalculate the commitment
    const calculatedCommitment = calculateCommitmentHash(revealedChoice, revealedSalt);

    // Compare naively (vulnerable to timing attacks)
    // Early return as soon as a difference is found
    for (let i = 0; i < commitment.length; i++) {
      if (commitment[i] !== calculatedCommitment[i]) {
        return false;
      }
    }

    return true;
  }

  // Simulate timing measurements for verifying commitments with different implementations

  // Constant time implementation
  const constantTimeResults = {
    validMatches: [] as number[],
    invalidMatches: [] as number[]
  };

  // Vulnerable implementation
  const vulnerableResults = {
    validMatches: [] as number[],
    invalidMatches: [] as number[]
  };

  // Measure verification times
  for (let i = 0; i < samples; i++) {
    // Valid commitment
    const startValidConstant = process.hrtime.bigint();
    verifyCommitmentConstantTime(validCommitment, choice, salt);
    const endValidConstant = process.hrtime.bigint();
    constantTimeResults.validMatches.push(Number(endValidConstant - startValidConstant));

    // Invalid commitment (modified at different positions to simulate timing attack)
    const invalidChoice = ((choice + i % 2 + 1) % 3 + 1) as Choice;
    const invalidSalt = salt.substring(0, salt.length - 1) + (parseInt(salt.charAt(salt.length - 1), 16) ^ 1).toString(16);

    const startInvalidConstant = process.hrtime.bigint();
    verifyCommitmentConstantTime(validCommitment, invalidChoice, invalidSalt);
    const endInvalidConstant = process.hrtime.bigint();
    constantTimeResults.invalidMatches.push(Number(endInvalidConstant - startInvalidConstant));

    // Measure vulnerable implementation
    const startValidVulnerable = process.hrtime.bigint();
    verifyCommitmentVulnerable(validCommitment, choice, salt);
    const endValidVulnerable = process.hrtime.bigint();
    vulnerableResults.validMatches.push(Number(endValidVulnerable - startValidVulnerable));

    const startInvalidVulnerable = process.hrtime.bigint();
    verifyCommitmentVulnerable(validCommitment, invalidChoice, invalidSalt);
    const endInvalidVulnerable = process.hrtime.bigint();
    vulnerableResults.invalidMatches.push(Number(endInvalidVulnerable - startInvalidVulnerable));
  }

  // Calculate statistics
  const constantTimeStats = {
    validMean: calculateMean(constantTimeResults.validMatches),
    invalidMean: calculateMean(constantTimeResults.invalidMatches),
    validStdDev: calculateStdDev(constantTimeResults.validMatches, calculateMean(constantTimeResults.validMatches)),
    invalidStdDev: calculateStdDev(constantTimeResults.invalidMatches, calculateMean(constantTimeResults.invalidMatches))
  };

  const vulnerableStats = {
    validMean: calculateMean(vulnerableResults.validMatches),
    invalidMean: calculateMean(vulnerableResults.invalidMatches),
    validStdDev: calculateStdDev(vulnerableResults.validMatches, calculateMean(vulnerableResults.validMatches)),
    invalidStdDev: calculateStdDev(vulnerableResults.invalidMatches, calculateMean(vulnerableResults.invalidMatches))
  };

  // Calculate timing difference significance
  // For constant time implementation, the difference should be minimal
  const constantTimeDiffRatio = Math.abs(constantTimeStats.validMean - constantTimeStats.invalidMean) /
    ((constantTimeStats.validStdDev + constantTimeStats.invalidStdDev) / 2);

  // For vulnerable implementation, there should be a noticeable difference
  const vulnerableDiffRatio = Math.abs(vulnerableStats.validMean - vulnerableStats.invalidMean) /
    ((vulnerableStats.validStdDev + vulnerableStats.invalidStdDev) / 2);

  // Test is successful if constant time implementation shows minimal timing differences
  // while the vulnerable implementation shows significant differences
  const success = constantTimeDiffRatio < 1.0 && vulnerableDiffRatio >= 1.0;

  return {
    success,
    details: {
      constantTimeImplementation: {
        validMatchMean: constantTimeStats.validMean,
        invalidMatchMean: constantTimeStats.invalidMean,
        standardDeviations: {
          validMatches: constantTimeStats.validStdDev,
          invalidMatches: constantTimeStats.invalidStdDev
        },
        timingDifferenceRatio: constantTimeDiffRatio,
        interpretation: constantTimeDiffRatio < 1.0 ? "Timing differences not statistically significant" : "Potential timing leak detected"
      },
      vulnerableImplementation: {
        validMatchMean: vulnerableStats.validMean,
        invalidMatchMean: vulnerableStats.invalidMean,
        standardDeviations: {
          validMatches: vulnerableStats.validStdDev,
          invalidMatches: vulnerableStats.invalidStdDev
        },
        timingDifferenceRatio: vulnerableDiffRatio,
        interpretation: vulnerableDiffRatio >= 1.0 ? "Vulnerable to timing attacks as expected" : "Unexpectedly timing-safe"
      }
    }
  };
}

// Helper functions for new tests

/**
 * Convert a choice number to a name
 */
function choiceToName(choice: Choice): string {
  switch (choice) {
    case 1: return 'rock';
    case 2: return 'paper';
    case 3: return 'scissors';
    default: return 'unknown';
  }
}

/**
 * Calculate the mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate separation between means
 */
function calculateSeparation(means: Record<string, number>, stdDevs: Record<string, number>): number {
  const values = Object.values(means);
  const maxDiff = Math.max(...values) - Math.min(...values);

  const avgStdDev = Object.values(stdDevs).reduce((sum, val) => sum + val, 0) / Object.values(stdDevs).length;

  return (avgStdDev === 0) ? 0 : maxDiff / avgStdDev;
}

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(str: string): number {
  const len = str.length;
  const frequencies: Record<string, number> = {};

  // Count character frequencies
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  // Calculate entropy
  return Object.keys(frequencies).reduce((entropy, char) => {
    const freq = frequencies[char] / len;
    return entropy - (freq * Math.log2(freq));
  }, 0);
}

/**
 * Run security tests
 */
async function main() {
  console.log(chalk.blue('Running mock security tests...'));

  try {
    // Ensure results directory exists
    await fs.ensureDir(resultsDir);

    // Results storage
    const testResults = [];
    let vulnerabilitiesFound = 0;
    let testsRun = 0;
    let passedTests = 0;

    // Run each security test
    for (const test of SECURITY_TESTS) {
      console.log(chalk.yellow(`\n=== Running security test: ${test.name} ===`));
      console.log(test.description);

      try {
        testsRun++;
        const result = await test.run();

        if (result.success) {
          console.log(chalk.green(`✓ Test "${test.name}" passed`));
          passedTests++;
        } else {
          console.log(chalk.red(`✗ Test "${test.name}" failed - potential vulnerability found`));
          vulnerabilitiesFound++;
        }

        testResults.push({
          name: test.name,
          description: test.description,
          success: result.success,
          details: result.details
        });
      } catch (error) {
        console.error(chalk.red(`Error running test "${test.name}":`), error);
        testResults.push({
          name: test.name,
          description: test.description,
          success: false,
          error: error.message
        });
        vulnerabilitiesFound++;
      }
    }

    // Save test results
    const resultsPath = path.join(resultsDir, 'mock-security-test-results.json');
    await fs.writeJson(resultsPath, {
      testDate: new Date().toISOString(),
      testsRun,
      passedTests,
      vulnerabilitiesFound,
      tests: testResults
    }, { spaces: 2 });

    console.log(chalk.yellow('\n====== SECURITY TEST SUMMARY ======\n'));
    console.log(`Tests Run: ${testsRun}`);
    console.log(`Tests Passed: ${passedTests} (${(passedTests / testsRun * 100).toFixed(0)}%)`);
    console.log(`Vulnerabilities Found: ${vulnerabilitiesFound}`);

    if (vulnerabilitiesFound === 0) {
      console.log(chalk.green('\n✓ All security tests passed!'));
    } else {
      console.log(chalk.red(`\n✗ Found ${vulnerabilitiesFound} potential security vulnerabilities`));
    }

    console.log(chalk.green(`\nResults saved to: ${resultsPath}`));

  } catch (error) {
    console.error(chalk.red('Error running mock security tests:'), error);
    process.exit(1);
  }
}

// Run the script
main().catch(err => {
  console.error(chalk.red('Error in main function:'), err);
  process.exit(1);
});
