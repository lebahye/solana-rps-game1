# Solana Rock Paper Scissors (RPS)

A fully-decentralised, wager-based Rock Paper Scissors game running on the Solana blockchain.  
Players stake SOL, commit moves with a cryptographic hash, reveal them later, and the on-chain program determines the winner and distributes prizes minus a small platform fee.

---

## Features
- 💸 **On-chain wagers** – all bets are escrowed inside a Solana Program Derived Account (PDA).  
- 🔐 **Commit / Reveal** – SHA-256 commit-and-reveal prevents front-running or cheating.  
- ⏱ **Timeout protection** – if an opponent becomes inactive you can claim victory.  
- 🏆 **Automatic payouts** – program pays the winner and sends a 1 % fee to the platform.  
- 🦾 **Modern React UI** – wallet-adapter, dark theme, responsive layout.  
- 🧪 **Anchor tests** – program logic covered by integration tests.  
- 🚀 **One-click deploy on Replit** – run the UI + local validator directly in the browser.

---

## Technology Stack
| Layer | Tech | Notes |
|-------|------|-------|
| Smart-Contract | **Rust + Anchor** | Declarative accounts, PDA escrow, events |
| Front-End | **React 18**, **TypeScript** | Create-React-App, hooks, Context |
| Wallets | `@solana/wallet-adapter` | Phantom, Solflare, Torus, Ledger |
| RPC / SDK | `@project-serum/anchor`, `@solana/web3.js` | client ↔ program |
| Styles | CSS Modules | Custom dark theme |
| Dev Ops | **Replit Nix** workspace | Local validator + CRA served via `vite` |

---

## Local Setup

### Prerequisites
| Tool | Minimum version |
|------|-----------------|
| Rust & Cargo | `rustup install stable` |
| Solana CLI | `solana --version` ≥ 1.17 |
| Anchor CLI | `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked` |
| Node / npm | Node ≥ 18 / npm ≥ 9 |

### Clone & Install
```bash
git clone https://github.com/lebahye/solana-rps.git
cd solana-rps
# install program deps
anchor build
# install client deps
cd solana-rps-client && npm install
```

### Run Locally
```bash
# 1️⃣ start a local validator in another shell
solana-test-validator -r

# 2️⃣ deploy program to localnet
anchor deploy

# 3️⃣ save generated IDL for the React client
anchor idl fetch --filepath ../solana-rps-client/src/idl/solana_rps.json RPS111111111111111111111111111111111111111

# 4️⃣ start the React app
npm start          # inside solana-rps-client
```
Open `http://localhost:3000` and connect Phantom (set network ➜ **Localnet**).

---

## Deploy on Replit in 5 Minutes

1. **Import repo** → *Create Repl from GitHub*.  
2. Replit detects a **Nix** template; if not, enable “Nix (advanced)”.  
3. The `replit.nix` installs Rust, Solana, Anchor, Node automatically.  
4. In the *Shell* run:
   ```bash
   solana-test-validator -r &
   anchor build && anchor deploy
   cd solana-rps-client && npm run build # or npm start
   ```
5. Add a **Web View** to expose port 3000.  
6. Share the public Replit URL – your dApp is live!

*Tip:* For mainnet/Devnet deployment replace the program ID in `.env` or directly inside `src/constants.ts` and run `anchor deploy --provider.cluster devnet`.

---

## Game Rules & Mechanics
1. **Create Game** – creator stakes *X* SOL and receives a Game PDA.  
2. **Join Game** – opponent stakes the same *X* SOL.  
3. **Commit** – each player submits `hash(move + salt)` on-chain.  
4. **Reveal** – each player reveals `move, salt`; program verifies hash.  
5. **Resolution**   
   - Win → winner gets `2X × 0.99` (1 % fee)  
   - Draw → each player gets refund (no fee)  
6. **Timeout** – after 10 min of inactivity, the responsive player may claim victory or refund according to the state.

Moves mapping  
`0 = Rock`, `1 = Paper`, `2 = Scissors`

---

## Architecture Diagram
```text
┌────────────────────────────────────────────────────────────────┐
│                          React Client                         │
│  ┌────────────┐   Web3.js / Anchor      ┌──────────────────┐  │
│  │ Wallet UI  │◀────────────────────────▶│  Solana RPC Node │  │
│  └────────────┘                         └──────────────────┘  │
│         ▲                                                ▲    │
└─────────┼────────────────────────────────────────────────┼────┘
          │                                                │
          │ Anchor                           Events        │
          ▼                                                │
┌───────────────────────────────────────────────────────────┼───┐
│                    Solana Program (PDA escrow)           │   │
│  Create ▶ Join ▶ Commit ▶ Reveal ▶ Settle ▶ Close        │   │
│  - Stores wagers & moves                                 │   │
│  - Validates hashes and timeouts                         │   │
│  - Transfers SOL & fee                                   │   │
└───────────────────────────────────────────────────────────┴───┘
```

---

## Future Improvements
- 🎮 **Best-of-N series** instead of single round.  
- 🪙 Use **SPL tokens / NFTs** as wagers or prizes.  
- 🏰 **DAO treasury** – redirect fees to a governance wallet.  
- 📱 **PWA / Mobile** installable version.  
- 🌐 Multi-language UI (i18n).  
- 🧑‍🤝‍🧑 Global **leaderboard & Elo ranking** stored on-chain.  
- 🔒 Third-party **security audit** of the Anchor program.  
- ⚙️ **CI/CD pipeline** – automatic devnet deploy & preview URL on PRs.

---

### License
MIT © 2025 — feel free to fork, improve and play responsibly!
