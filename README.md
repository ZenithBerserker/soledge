# Meteora DLMM scanner (dashboard + worker)

This repo splits responsibilities so you can deploy **what fits on Vercel** (the Next.js UI + ingest API + Postgres) while running **what cannot** (Yellowstone gRPC, sustained RPC subscriptions, Jito bundle submission) on a dedicated low-latency host.

## Architecture

| Piece | Where it runs | Role |
|--------|----------------|------|
| `apps/web` | **Vercel** | Dashboard, `POST /api/opportunities` (authenticated), `GET /api/opportunities`, health |
| `packages/core` | Shared library | DLMM `swapQuote` math, slippage guards, blacklist, tip heuristic |
| `apps/worker` | **Fly.io / Railway / bare metal** | Poll loop (MVP) or future Yellowstone stream consumer |

Ultra-low-latency streaming and bundle landing are **host-bound**, not framework-bound: serverless functions have short timeouts and no durable sockets, so the worker is intentionally separate.

Related upstream patterns (Yellowstone/Jupiter/Rust bots, execution hygiene): see [docs/REFERENCES.md](docs/REFERENCES.md).

## Quick start (local)

```bash
npm install
cp env.example .env
# Set DATABASE_URL for Neon/Supabase locally if you want persistence

cd apps/web && npx prisma db push && cd ../..

npm run dev
# Worker (separate terminal):
cd apps/worker && cp ../../env.example ../../.env  # wire POOL_A/B + START_MINT
npm run dev -w @solana-mev-bot/worker
```

## Deploy dashboard on Vercel

1. Create a Postgres database (**Neon**, **Supabase**, or Vercel Postgres) and set `DATABASE_URL` in the Vercel project. For **Supabase**, prefer the **Session pooler** URI for serverless (`:6543` + `pgbouncer=true`); use the **Direct** (`:5432`) URL when running `prisma migrate deploy` / `db push` from your laptop if the pooler complains.
2. In the Vercel project, set **Root Directory** to `apps/web`, **Install command** to `cd ../.. && npm install`, **Build command** to `npx prisma generate && next build`.
3. Add `ENGINE_INGEST_SECRET` (same value you give the worker) and **`HELIUS_API_KEY`** if you use **Simulate snipe** on `/dashboard` (server re-quote).
4. **Create tables once** in the same database Vercel uses (copy `DATABASE_URL` from Vercel or Neon):
   ```bash
   cd apps/web
   export DATABASE_URL="postgresql://…"   # same as Vercel
   npx prisma migrate deploy
   ```
   (Alternative: `npx prisma db push` if you prefer not to use migration files.)

## Deploy worker

Build and run the worker where you can keep a long-lived process and use a colocated RPC / gRPC endpoint:

```bash
npm run build -w @solana-mev-bot/core
npm run build -w @solana-mev-bot/worker
HELIUS_API_KEY=... POOL_A=... POOL_B=... START_MINT=... DASHBOARD_URL=... ENGINE_INGEST_SECRET=... node apps/worker/dist/index.js
```

## What is implemented vs. what you extend

- **Implemented:** Two-pool, same-pair Meteora DLMM round-trip quote using `swapQuote` and bin arrays, output in the “live opportunity” shape, POST to your Vercel API, simple feed + **`/dashboard`** (Tailwind shell, live rows, disabled Snipe button placeholder), worker hook **`EXECUTION_MODE=simulate`** (logs a dry-run plan only).
- **You extend:** Full SOLEDGE-style panels (Shredstream, smart money, charts), multi-hop graph, cross-DEX, Yellowstone, **real Jito bundles + signing** (explicit security/custody work — `EXECUTION_MODE=live` is a stub).

### Both tracks (UI + execution)

| Track | Now | Next milestones |
|--------|-----|-------------------|
| **Dashboard** | `/dashboard` layout + opportunity list | Real-time streams, filters, charts, enabled Snipe after execution exists |
| **Execution** | `simulate` logs only; `live` warns | Wallet + swap instructions + Jito API + simulation gate + caps |

## Disclosures

On-chain markets are adversarial. Extreme quoted multiples are often **stale-bin artifacts** or **non-executable** once fees, account rent, and competing bots are included. This code is for **research and integration scaffolding**; it is not financial advice. Running automated execution carries legal and financial risk in your jurisdiction.

## Legacy / imports

- Earlier experiments live in `_legacy/` for reference only.
- A Claude-export **`soledge-repo.zip`** was reviewed: ingest now also accepts **`Authorization: Bearer`** (see `env.example` / `ENGINE_BOT_TOKEN`). The full Tailwind dashboard + `@soledge/db` schema from that zip was **not** merged (different stack); the zip is kept under `_legacy/` if you want to cherry-pick UI later.
