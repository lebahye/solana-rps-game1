# Solana RPS Game - Frontend

This directory contains the frontend React application for the Solana Rock Paper Scissors game.

## Structure

- `src/` - Source code for the React application
  - `autoplay/` - Components and logic for the automated gameplay feature
  - `components/` - Reusable UI components
  - `services/` - Services for interacting with tokens and other utilities
  - `views/` - Page-level React components
  - `App.tsx` - Main application component
  - `rps-client.ts` - Client for interacting with the Solana smart contract
  - `types.ts` - TypeScript type definitions

- `public/` - Static assets

## Features

- Wallet connection (Phantom, Solflare) for Solana integration
- Game creation and joining functionality
- Rock Paper Scissors gameplay mechanics
- Automated gameplay with various betting strategies
- Token management (SOL and RPS tokens)

## Development

To start the development server:

```bash
cd frontend
bun install
bun dev
```

## Building

To build the application for production:

```bash
cd frontend
bun build
```

The build output will be in the `dist/` directory.
