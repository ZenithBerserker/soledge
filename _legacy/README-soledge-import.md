# Claude “soledge repo” export

The `soledge-repo.zip` archive was a larger monorepo (Tailwind dashboard, NextAuth, Stripe, `@soledge/db` with `arbOpportunity` / `alphaAlert` models, `apps/engine`, etc.).

**Merged into the main app (by hand):**

- Ingest auth compatible with that template: `Authorization: Bearer …` plus optional `ENGINE_BOT_TOKEN`.
- Env / README notes for **Supabase** pooled vs direct Postgres URLs.
- Dashboard copy aligned with the Meteora arb description from that tree.

**Not merged:** full UI, Prisma mega-schema, engine app — they target a different architecture than this repo’s `OpportunityLog` JSON + `packages/core` worker.

To inspect the original files, unzip `soledge-repo.zip` locally (do not commit extracted trees to keep the repo small).
