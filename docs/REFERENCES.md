# External references (architecture inspiration)

Snapshot only — **we do not mirror these repos automatically.** Re-review upstream when you change execution paths.

| Repo | Stack | Useful ideas for this project |
|------|--------|--------------------------------|
| [machenxi/meteora-sniper-bot](https://github.com/machenxi/meteora-sniper-bot) | TypeScript, Meteora, Yellowstone gRPC, Jito bundles | Priority fees / CU limits, `simulateTransaction` before send, Jito with RPC fallback, tx assembly discipline |
| [SaoXuan/rust-mev-bot-shared](https://github.com/SaoXuan/rust-mev-bot-shared) | Rust, Jupiter, Jito (commercial/binary distribution) | Multi-region engines, aggressive tipping mindset — **verify any binary vendor yourself** |
| [hanshaze/solana-sniper-copy-trading-bot](https://github.com/hanshaze/solana-sniper-copy-trading-bot) | README / pointers | Thin README; treat linked “latest” repos skeptically |
| [Cetipoo/solana-mev-bot](https://github.com/Cetipoo/solana-mev-bot) | Marketing shell → separate repos/docs | Multi-DEX on-chain program narrative; **not integrated** — our stack is app/worker + Meteora DLMM two-pool + optional wallet send |

## What we adopted here

- Compute budget + optional **priority fee** (`COMPUTE_UNIT_LIMIT`, `PRIORITY_FEE_MICRO_LAMPORTS`) on merged arb txs.
- **`simulateTransaction`** before RPC send and before Jito bundle submit (arb leg), skippable via `EXECUTION_SKIP_SIMULATE`.
- Optional **`EXECUTION_JITO_FALLBACK_RPC`** if Block Engine `sendBundle` fails before a successful submit path.

## Out of scope (follow upstream if you need them)

- **Shredstream-only / ultra-low-latency landing paths** beyond what our scaffold covers — tune subscriptions + infra per provider.
- **Multi-wallet parallel sends**, Jupiter aggregation, Pump.fun routing — different product surface than our two-pool DLMM divergence worker.

## Implemented here (incremental)

- **Multi-pair polling**: worker reads `POOL_PAIRS_JSON` or `POOL_PAIRS_FILE` (see `apps/worker/config/pool-pairs.example.json`) and scans each pair every tick with optional `PAIR_STAGGER_MS`.
- **Yellowstone gRPC scaffold** (`WORKER_MODE=stream|both`): `@triton-one/yellowstone-grpc` subscription on Meteora LB program txs; optional **`STREAM_BRIDGE_*`** cooldown bridge into `compareDlmmPairPools` + ingest (`scannerKind=grpc-bridge`). Pure stream without bridge does **not** require `HELIUS_API_KEY`.
