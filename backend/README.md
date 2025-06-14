# Solana RPS Game - Backend

This directory contains the backend components of the Solana Rock Paper Scissors game.

## Structure

- `solana-program/` - Solana smart contract written in Rust
  - `src/` - Source code for the Solana program
    - `lib.rs` - Main program logic
  - `Cargo.toml` - Rust dependencies and build configuration

## Features

- Solana blockchain integration
- Game state management
- Player matching system
- Wager and payout handling
- Multi-round gameplay support
- Timeout resolution
- Currency options (SOL and RPS tokens)

## Development

### Prerequisites

- Rust and Cargo
- Solana CLI tools
- Anchor framework (for development and testing)

### Building the Solana Program

```bash
cd backend/solana-program
cargo build-bpf
```

### Deploying the Program

```bash
solana program deploy target/deploy/rps_game.so
```

### Local Testing

For local testing, you can use the Solana test validator:

```bash
solana-test-validator
```

## Integration with Frontend

The frontend interacts with this Solana program through the `RPSGameClient` class, which uses the Solana Web3.js library to submit transactions to the blockchain.
