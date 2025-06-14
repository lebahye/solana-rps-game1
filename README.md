# Solana Rock Paper Scissors Game

A full-stack decentralized game built on the Solana blockchain that allows players to play Rock Paper Scissors with cryptocurrency stakes.

## Project Overview

Solana RPS Game is a decentralized Rock Paper Scissors game built on the Solana blockchain. The game allows players to compete against each other in a transparent, fair environment with cryptographic commitment schemes to ensure fairness.

## Play Online

You can play this game online at: https://lebahye.github.io/solana-rps-game/

## How to Play

1. Connect your Solana wallet (Phantom recommended)
2. Create a new game or join an existing one
3. Wager SOL or RPS tokens
4. Make your selection (Rock, Paper, or Scissors)
5. Wait for your opponent to make their selection
6. Reveal your choice
7. See who wins!

## Repository Structure

- `/backend` - Solana program (smart contract) written in Rust
- `/frontend` - Web frontend interface built with React
- `/testing` - Comprehensive testing framework

## Features

- **Decentralized Gameplay**: All game mechanics are enforced by a Solana smart contract.
- **Multi-player**: Supports 3-4 player games.
- **Commit-Reveal Scheme**: Ensures fair play by preventing players from seeing others' choices.
- **Betting System**: Players can place SOL bets to compete for a prize pool.
- **Multi-Round Games**: Set up games with multiple rounds to find a true winner.
- **Timeout Resolution**: Handles players who disconnect or fail to respond.
- **Rejoining Mechanism**: Losers can rejoin for another game (if enabled).
- **Automated Gameplay**: New feature that allows for automated playing and betting.
- **Wallet Integration**: Connect with Phantom or Solflare wallets
- **Game Mechanics**: Play Rock Paper Scissors with multiple players
- **Blockchain Integration**: All game actions are recorded on the Solana blockchain
- **Token Support**: Stake SOL or custom RPS tokens
- **Auto-Play Mode**: Let the computer play for you with automated betting strategies
- **Player Matching**: System automatically matches players into games
- **Advanced Betting**: Multiple betting strategies including Martingale, D'Alembert, and Fibonacci

## Testing Framework

The project includes a robust testing framework for ensuring game security, fairness, and performance. The testing suite covers:

- **Security Tests**: Detection of vulnerabilities in the game implementation
- **Performance Benchmarks**: Measurement of critical operations performance
- **E2E Integration Tests**: Simulation of complete game flows
- **Fairness Tests**: Verification of game outcome distribution
- **Mock Testing**: Simulation of blockchain interactions for development

### Recent Testing Enhancements

The testing framework has been significantly improved with the following features:

1. **Enhanced Security Tests**: Added advanced security tests for transaction replay attacks, commitment revelation analysis, and timing attacks.
2. **Improved Commitment Hash Function**: Fixed a security vulnerability by upgrading from SHA256 to HMAC-SHA512 with increased salt size.
3. **Test Results Dashboard**: Added a visual dashboard to display test results with charts and metrics.
4. **Continuous Integration**: Set up GitHub Actions workflow for automated testing on code changes.

### Running Tests

```bash
# Navigate to testing directory
cd testing

# Install dependencies
npm install

# Generate test wallets
npm run generate-wallets

# Run all mock tests
npm run run-all-mock-tests

# Generate dashboard
npm run generate-dashboard
```

The test dashboard will be available at `testing/dashboard/index.html`.

## How the Game Works

### Game Flow

1. A player creates a game, setting player count, entry fee, number of rounds, etc.
2. Other players join the game, placing their entry fee.
3. When enough players have joined, the game starts.
4. Each round follows a commit-reveal pattern:
   - **Commit Phase**: Players select and commit their choices (Rock, Paper, or Scissors).
   - **Reveal Phase**: Players reveal their committed choices.
5. After each round, scores are calculated and the next round begins.
6. After all rounds, winners can claim their share of the prize pool.

### Scoring

- Each player's choice is compared against all other players.
- For each comparison, points are awarded according to standard Rock-Paper-Scissors rules:
  - Rock beats Scissors
  - Scissors beats Paper
  - Paper beats Rock
- Players with the highest score after all rounds win.

## Automated Gameplay

The new auto-play feature allows players to:

1. **Set a Wager Amount**: Choose how much SOL to bet on each round.
2. **Start Automated Play**: The system will automatically play rounds:
   - Creating games
   - Making random choices
   - Processing results
   - Tracking statistics
3. **View Real-time Stats**:
   - Current win/loss streak
   - Total wins and losses
   - Amount wagered
   - Net profit/loss
4. **Game History Visualization**: See a record of all games played with win/loss indicators.

This feature is perfect for players who want to:
- Test different betting strategies
- Play many games quickly
- Let the system play while they're away
- Track their performance over time

*Note: In the current implementation, auto-play runs as a simulation and doesn't make actual blockchain transactions.*

## Tournament Mode

Looking for bigger thrills? Launch a single-elimination bracket and fight your way to the top.

1. Create or join a **Tournament Lobby** (new “Tournament” button in the nav).
2. Host sets • name • max-players (power-of-two) • entry fee • currency (SOL / RPS Token).  
3. Players pay the entry fee and appear in the lobby list.  
4. Host presses **Start** – brackets are generated automatically (byes are handled).  
5. Click **Play Match** on your pairing; a standard RPS game launches.  
6. Winners advance until a champion is crowned and the prize-pool paid out.  

The entire flow is on-chain, so brackets and results are provably fair. Sound cues and bracket animations keep the experience lively.

## Audio & Sound Controls

Every UI action and game event now ships with polished FX plus background music.

– Toggle sound or music in the top-right speaker icon.  
– Volume sliders are in **Profile → Settings → Audio** (persisted in `localStorage`).  
– Effects volume defaults to 70 %, music to 40 %.  
– Autoplay policies: the first user click unlocks audio; if you see *“Audio blocked”* open browser settings and allow sound.

Sound effect list (examples): commit / reveal, win / loss, jackpot, bracket win, notifications.

## Monitoring & Metrics

`backend/monitoring/metrics.ts` exposes real-time Prometheus metrics:

```bash
cd backend/monitoring
npm i
node metrics.ts      # default http://localhost:9095/metrics
```

Key series include:
`rps_games_created_total`, `rps_fees_collected_total{currency="SOL"}`, `rps_program_transactions_processed_total{status="failure"}`, plus histogram buckets for game duration and poll time.  
Hook Grafana alerts to be paged on • high tx failure rate • stalled games • fee sweep anomalies.

## Scaling & Performance Considerations

• Program is stateless per instruction and fits comfortably under Solana’s compute limits – measured < 30 k CU per move.  
• Use **priority fees** on mainnet for peak-traffic fairness.  
• Batch fee-sweeps and winner payouts to reduce write-locks.  
• Run multiple RPC providers (Helius, Triton, Shyft) behind a load-balancer for high-avail front-end reads.  
• Enable WebSocket subscriptions only while a game is active to save connection quotas.

## Replit / AI Tool Compatibility

Replit Tips  
1. `.replit` already installs Node 20 + Rust stable and serves Vite on port 5000.  
2. Add secrets in **Tools → Secrets** (`VITE_RPS_PROGRAM_ID`, etc.).  
3. Storage is 1 GiB – run `build.sh clean` to free space after deploying the program.  
4. If Nix fetch errors appear, click **“Rebuild nix environment”**.  
5. AI coding companions (Cursor, Copilot) work out-of-the-box; for best suggestions keep `types.ts` and IDL in repo root.

## Technology Stack

- **Blockchain**: Solana
- **Smart Contract**: Written in Rust
- **Frontend**: React with TypeScript
- **Wallet Integration**: Solana Wallet Adapter
- **Serialization**: Borsh

## Component Overview

### Quick Start / Local Setup

```bash
# 1. Clone
git clone https://github.com/yourusername/solana-rps-game.git
cd solana-rps-game

# 2. Install root dependencies (uses Bun – fall back to npm if you prefer)
bun install          # or: npm install

# 3. Copy environment template and edit RPC / program-id
cp .env.example .env
#   ├─ VITE_RPC_ENDPOINT=https://api.devnet.solana.com
#   ├─ VITE_RPS_PROGRAM_ID=<deployed_program_id>
#   └─ (optional) VITE_RPS_TOKEN_MINT=<spl_token_mint>

# 4. Start the full-stack dev environment
#    ‑ Front-end @ http://localhost:5173
#    ‑ Solana test-validator in a separate terminal (`solana-test-validator`)
bun run dev
```

### Solana Program (Smart Contract)

- `solana-rps-program.rs`: The Rust smart contract implementing the game logic.

### Frontend Components

- `App.tsx`: Main application component and router
- `rps-client.ts`: Client library for interacting with the Solana program
- Views:
  - `HomeView.tsx`: Main menu screen
  - `CreateGameView.tsx`: Form for creating a new game
  - `JoinGameView.tsx`: Screen for joining an existing game
  - `GameLobbyView.tsx`: Waiting room for players to join
  - `CommitChoiceView.tsx`: Screen for committing a choice
  - `RevealChoiceView.tsx`: Screen for revealing committed choices
  - `GameResultsView.tsx`: Displays game results and winner

## Getting Started

### Prerequisites

- Node.js 14+ and npm or bun
- Solana CLI tools (for deploying the program)
- A Solana wallet (Phantom, Solflare, etc.)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/solana-rps-game.git
   cd solana-rps-game
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Configure your environment variables:
   - Create a `.env` file and add your RPC endpoint and other configurations
   - Set the program ID in `App.tsx` (after deploying the Solana program)

4. Start the development server:
   ```
   bun run dev
   ```

### Frontend Development

```bash
cd frontend
bun install
bun dev
```

The development server will start at http://localhost:5173

---

## Testing Framework

### Deploying the Solana Program

1. Build the program:

#### Run All Tests End-to-End

```bash
# one-liner
cd testing && npm i && npm run run-all-tests

# Or run the new comprehensive script (requires ts-node):
npm run test-comprehensive
```

All tests spin up a local `solana-test-validator` by default.  
To run against devnet set `RPC_ENDPOINT=https://api.devnet.solana.com` in `.env`.
   ```
   cd backend/solana-program
   cargo build-bpf
   ```

2. Deploy to Solana devnet:
   ```
   solana program deploy target/deploy/rps_game.so
   ```

3. Update the program ID in `App.tsx` with the address from the deployment:
   ```typescript
   const RPS_PROGRAM_ID = new PublicKey('your_program_id_here');
   ```

## Playing the Game

1. **Create a Game**:
   - Connect your wallet
   - Click "Create Game"
   - Set the entry fee, player count, rounds, etc.
   - Share the game ID with friends

2. **Join a Game**:
   - Connect your wallet
   - Click "Join Game"
   - Enter the game ID
   - Pay the entry fee

3. **Make Your Move**:
   - Choose Rock, Paper, or Scissors
   - Commit your choice
   - Wait for all players to commit

4. **Reveal Your Choice**:
   - Reveal your choice when all players have committed
   - Wait for all players to reveal

5. **See Results**:
   - View the results and scores
   - If you won, claim your winnings
   - Play additional rounds if configured

---

## Deployment

### Replit (one-click)

1. Press “Import from GitHub” in Replit and select this repo.  
2. Open the **Secrets** tab and add the same variables you placed in `.env`.
3. Hit **Run** – the `.replit` file builds the front-end and serves it on port 5000.  
4. (Optional) run `solana program deploy` from the Replit shell or deploy externally and paste the program-id.

More detailed instructions (CI, Netlify, Docker) are in [`DEPLOYMENT.md`](DEPLOYMENT.md).

### Manual Production Build

```bash
# build front-end
cd frontend && npm i && npm run build

# serve statically (e.g. Netlify, Vercel, Nginx)
```

---

## Fee Collection & Monitoring

The on-chain program withholds **1 %** of every entry fee (`FEE_PERCENTAGE = 10/1000`).  
Collected fees accumulate in the game account and can be swept by calling the
`CollectFees` instruction.  The CLI helper:

```bash
ts-node scripts/collect-fees.ts <game_pubkey> <fee_collector_keypair>
```

Back-end keeps a `fee_collected` counter; after a successful sweep it resets to 0.

---

## Security Architecture

* **Commit-Reveal** upgraded to HMAC-SHA-512 with 32-byte salt – prevents brute-force & timing attacks.  
* Program enforces:
  * Unique player list & max 4 players
  * PDA-signed SOL / SPL-token transfers
  * Timeout resolver to kick unresponsive players
* Front-end disables dangerous window globals and rate-limits actions.

For an in-depth audit checklist see `/testing/scripts/security-checklist.md`.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `Buffer is not defined` in browser | Missing polyfill | Ensure `polyfill-bundle.js` is loaded (already referenced in `index.html`) |
| `Transaction exceeds size limit` | Too many accounts in one tx | Upgrade to v1.17+ client or split transaction |
| Game stuck in **Commit** | Not all players committed | Wait for timeout then click **Resolve Timeout** |
| Fee sweep fails `Not authorized` | Wrong signer | Use the fee-collector keypair specified in `.env` |
| No sound / music | Browser autoplay blocked | Click anywhere in page or enable sound for site |
| `/metrics` 404 | Monitoring service not running | `node backend/monitoring/metrics.ts` then scrape `:9095/metrics` |

## Security

The commit-reveal scheme ensures that:
- Players cannot see others' choices during commitment
- Players cannot change their choices after commitment
- Players cannot lie about their committed choices during reveal

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Solana Foundation
- React and TypeScript communities
- All contributors and users of the game
