# Claude “soledge” exports (zip files in this folder)

## Your **deployed** app (`apps/web` in repo root)

- Uses **`OpportunityLog`** (single JSON `payload` per row) — not `ArbOpportunity`.
- **`/api/health`** with `"db": true`** means Postgres is fine.
- **“Database connected — no opportunities yet”** is normal until something **`POST`s** to **`/api/opportunities`** (worker or `curl` test). That is **not** a Prisma-schema bug.

## What’s inside **`soledge-repo.zip`** (Claude repacks)

That archive is a **different monorepo**: `@soledge/db`, relational **`ArbOpportunity`** model, **`ARB_DETECTED`** alerts, Tailwind + **`lucide-react`**, **`src/app`** paths, validation gates (e.g. reject `projectedReturnX < 2`), etc.

**We do not merge that wholesale** into this repo — it would replace Prisma schema, paths, and styling. If you want those features, cherry-pick ideas only (e.g. expiry logic) and re-implement against **`OpportunityLog`**.

## Repack (2026-05-04) highlights (for reference)

- `apps/web/src/app/api/opportunities/route.ts` — `arbOpportunity` CRUD + 2x / 30% slippage gates.
- `apps/web/src/app/dashboard/arb/ArbFeed.tsx` — client poll feed (needs Tailwind + `@soledge/db`).

Unzip locally to read; avoid committing extracted trees.

**Do not** add a public `/api/migrate` that runs DDL from the browser (anyone could hit it). Use `npx prisma migrate deploy` or `db push` from your machine with `DATABASE_URL` instead.
