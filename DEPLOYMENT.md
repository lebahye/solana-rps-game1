# Deployment Guide

This document explains how to take **Solana Rock Paper Scissors Game** from source to production.  
Primary target: **Replit**.  Alternative targets (Netlify, GitHub Pages, Docker/VPS) are covered afterward.

---

## 1. Prerequisites

| Tool | Version (tested) | Purpose |
|------|------------------|---------|
| Node.js / Bun | Node ≥ 18 **or** Bun ≥ 1.1 | Front-end build scripts |
| Rust & Cargo | stable (2024-05) | Building the on-chain program |
| Solana CLI | v1.18+ | Deploying program / local validator |
| Anchor (optional) | 0.29 | Easier Solana testing |
| Git | any | Version control |
| Replit account | free tier OK | Hosting front-end & light back-end tasks |

> ⚠️  Windows users: Install **WSL2** or use Git Bash to avoid path issues with Solana CLI.

---

## 2. Environment Variables

Create a `.env` file **in both root and `/frontend`**.  Replit automatically injects secrets set via the **“Secrets”** tab; locally you simply commit an `.env.example` and keep real keys untracked.

```env
# ---- root .env ----
# Where to deploy Solana transactions
VITE_RPC_ENDPOINT=https://api.devnet.solana.com

# The programId printed after `solana program deploy`
VITE_RPS_PROGRAM_ID=7Y9dRMY6V9cmVkXNFrHeUZmYf2tAV5wSVFcYyD5bLQpZ
# Optional: custom token mint for RPS_TOKEN mode
VITE_RPS_TOKEN_MINT=<mint-address>

# Netlify / CI
SITE_URL=https://your-site.netlify.app
```

The **`VITE_`** prefix is required for Vite to expose variables to the React app.

---

## 3. Deploying the Solana Program

You can deploy **outside** Replit (recommended) or **inside**.

### 3.1 Outside Replit (local machine)

```bash
cd backend/solana-program
cargo build-bpf
solana program deploy --url devnet target/deploy/solana_rps.so
# Copy the program Id printed by the CLI into .env
```

### 3.2 Inside Replit

Replit’s Nix environment already installs Rust (see `.replit`).  
Open the **Shell** tab and run the same commands as above.  Large binaries may hit the 1 GiB storage cap—delete `target/` after deployment if needed.

---

## 4. Replit Deployment (front-end)

The repo includes a `.replit` file and two workflows:

| Workflow | What it does |
|----------|--------------|
| **Run Frontend Dev** | Installs deps and runs `npm run dev` on port 5000 |
| **Run Frontend**     | Re-installs deps (for fresh workspace) and runs production build |

### 4.1 First-time Setup

1. Import the GitHub repo into Replit → “Create Repl from GitHub”.
2. In the left sidebar click **“Secrets”** → add the variables described in §2.
3. (Optional) bump the **Nix channel** in `.replit` if you need a newer Rust.

### 4.2 Development Mode

Press the **Run** button (mapped to *Run Frontend Dev*).  
Replit maps port 5000 automatically → access via `https://<your-repl>.leonrepl.co`.

### 4.3 Production Mode

1. In “Shell” run:

   ```bash
   npm run build
   npm run preview -- --host 0.0.0.0 --port 5000
   ```

2. Or select the “Run Frontend” workflow from the Run dropdown.

Static assets are served by Vite’s preview server.  For heavy traffic use Netlify (below).

---

## 5. Alternative Deployments

### 5.1 Netlify (recommended for static front-end)

```bash
cd frontend
npm i
npm run build
netlify deploy --prod --dir=dist
```

Set the variables in **Site → Settings → Build & Deploy → Environment**.

### 5.2 GitHub Pages

1. `cd frontend && npm run build`
2. Commit `dist/` to a `gh-pages` branch or use `gh-pages` npm package.
3. GitHub Pages cannot proxy to Solana RPC → ensure CORS is allowed or tunnel via Cloudflare.

### 5.3 Docker / VPS (full-stack)

```dockerfile
# Dockerfile
FROM node:20-bullseye as build
WORKDIR /app
COPY frontend ./frontend
RUN cd frontend && npm ci && npm run build

FROM nginx:1.25-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
```

Deploy with:

```bash
docker build -t rps-game .
docker run -d -p 80:80 rps-game
```

---

## 6. CI/CD Tips

- GitHub Actions sample:

```yaml
name: Netlify Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd frontend && npm ci && npm run build
      - uses: netlify/actions/cli@v2
        with:
          args: deploy --dir=frontend/dist --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

- Use **`solana-test-validator`** inside CI for unit tests.

---

## 7. Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| `Buffer is not defined` | Browser polyfills missing | Ensure `polyfill-bundle.js` is imported before React (already in template) |
| `Uncaught (in promise) Error: failed to send transaction` | Not enough SOL | Airdrop to wallet on devnet: `solana airdrop 2` |
| Front-end cannot connect to wallet | Phantom disabled on HTTP | Use **https** Replit URL or enable “Allow insecure” in Phantom dev settings |
| `program failed to complete` | Program panic | Check **Program Logs** tab in Solana Explorer; rebuild with `cargo build-bpf --debug` for clearer logs |
| `Transaction exceeds size` | Too many accounts in one tx | Split into multiple transactions (e.g., fee payment + join) |
| Netlify deploy works but blank page | Wrong `VITE_RPS_PROGRAM_ID` or `VITE_RPC_ENDPOINT` | Verify env vars in Netlify UI |

---

## 8. Next Steps

1. **Run the test suite**

```bash
cd testing
npm i
npm run run-all-mock-tests
```

2. **Security audit** – at minimum run `cargo audit` and `anchor audit` (if using Anchor).

3. **Mainnet deployment** – switch `VITE_RPC_ENDPOINT` to a paid RPC (e.g., Helius) and redeploy program with enough rent.

Happy deploying!  
— *The Solana RPS Team*
