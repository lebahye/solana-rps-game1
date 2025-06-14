# Multi-Wallet Testing Guide for Solana RPS Game

This guide explains how to test the Solana Rock Paper Scissors game with multiple wallets across different devices to ensure it works reliably in a real-world scenario.

## Prerequisites

- Multiple devices (computers, tablets, or smartphones)
- Solana wallets on each device (Phantom, Solflare, etc.)
- SOL test tokens on each wallet (from Solana devnet faucet)

## Setup Testing Environment

### 1. Deploy the Game for Testing

The game must be accessible from all testing devices. You have several options:

#### Option A: Deploy to Netlify (Recommended)

```bash
# From the project root
cd solana-rps-game/frontend
npm run build
# Then use the deploy tool to deploy to Netlify
```

#### Option B: Local Network Server

If testing on the same local network:

```bash
# From the project root
cd solana-rps-game/frontend
npm run dev
```

Then allow other devices on your local network to access it by sharing your computer's local IP address (e.g., http://192.168.1.100:5173).

### 2. Prepare Test Wallets

For each testing device:

1. Install a Solana wallet (Phantom or Solflare recommended)
2. Switch the wallet to Devnet mode
3. Get SOL test tokens from a [Solana devnet faucet](https://solfaucet.com/)

## Testing Process

### Step 1: Game Creation Test

1. **On Device 1 (Host)**:
   - Connect your wallet to the game
   - Click "Create Game"
   - Set game parameters (entry fee, player count, etc.)
   - Create the game and note the Game ID
   - The Game Lobby will show you as the host

2. **Verify Game Creation**:
   - Check that the game appears in the lobby with the correct settings
   - Verify your wallet address is displayed as the host
   - Confirm the game state is "Waiting for Players"

### Step 2: Game Joining Test

1. **On Device 2 (Player 2)**:
   - Connect a different wallet to the game
   - Click "Join Game"
   - Enter the Game ID from Step 1
   - Join the game

2. **Verify Joining**:
   - Device 1 should see Player 2 join the lobby in real-time
   - Device 2 should see both wallets in the lobby
   - Player counts should update correctly on both devices

3. **Repeat for Additional Players**:
   - If testing a 3 or 4 player game, repeat on Devices 3 and 4

### Step 3: Gameplay Testing

1. **Start the Game**:
   - On Device 1 (Host), click "Start Game" once all players have joined
   - All devices should transition to the Commit Choice screen

2. **Make Choices**:
   - On each device, select Rock, Paper, or Scissors
   - Commit your choice

3. **Reveal Phase**:
   - After all players have committed, devices should transition to the Reveal screen
   - Confirm all devices can reveal their choices

4. **View Results**:
   - All devices should show the same game result
   - Verify the winner calculation is correct
   - Check that tokens are transferred correctly

### Step 4: Edge Case Testing

1. **Disconnection Scenarios**:
   - Test what happens if a player disconnects during the game
   - Test reconnecting during different game phases

2. **Timeout Scenario**:
   - Have one player intentionally not commit/reveal
   - Verify the timeout mechanism works properly

3. **Multiple Games**:
   - After finishing one game, start a new one
   - Ensure game state is properly reset

## Troubleshooting Common Issues

### Player Can't See Others in the Lobby

- Check that all players are on the same network (Devnet)
- Verify the Game ID was copied correctly
- Refresh the browser and reconnect the wallet

### Game Won't Start

- Ensure you have enough players (minimum player count)
- Check that the host is the one pressing the Start button
- Verify all players have paid the entry fee

### Transactions Failing

- Check wallet SOL balance (devnet)
- Verify wallet is connected to Devnet
- Try refreshing the browser and reconnecting

## Reporting Issues

When reporting issues from multi-wallet testing, include:

1. The exact sequence of steps that caused the issue
2. Device types and wallet types involved
3. Screenshots from each device showing the issue
4. The Game ID where the issue occurred
5. Any error messages displayed in the UI or browser console

## Security Considerations

- Use only devnet SOL for testing
- Never use real SOL or mainnet wallets for testing
- Don't share test wallet private keys or seed phrases

## Responsible Data Usage

- Clean up after testing by spending/recovering any unused devnet SOL
- Delete any test wallets after testing is complete
- Do not store personally identifiable information in test wallets
