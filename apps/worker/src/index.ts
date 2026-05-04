/**
 * Long-running process: NOT for Vercel. Run near your RPC.
 * Configure one pair via POOL_A/POOL_B/START_MINT or many via POOL_PAIRS_JSON / POOL_PAIRS_FILE.
 */
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
  type LiveOpportunity,
} from '@solana-mev-bot/core'
import { maybeLogExecutionPlan } from './execution'
import { loadPoolPairs, type WorkerPoolPair } from './poolPairs'

const AMOUNT_RAW = process.env.AMOUNT_RAW ?? '1000000'
const POLL_MS = Math.max(3_000, Number(process.env.POLL_MS) || 15_000)
/** Delay between scanning each pair inside one tick (reduces RPC bursts). */
const PAIR_STAGGER_MS = Math.max(0, Number(process.env.PAIR_STAGGER_MS) || 250)
const DASHBOARD_URL = process.env.DASHBOARD_URL
const INGEST_SECRET = process.env.ENGINE_INGEST_SECRET

function requireEnv(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

async function postOpportunity(body: object) {
  if (!DASHBOARD_URL || !INGEST_SECRET) {
    console.log('[worker] DASHBOARD_URL or ENGINE_INGEST_SECRET unset — logging only:')
    console.log(JSON.stringify(body, null, 2))
    return
  }
  const url = new URL('/api/opportunities', DASHBOARD_URL).toString()
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-engine-secret': INGEST_SECRET,
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    console.error('[worker] ingest failed', r.status, await r.text())
  } else {
    console.log('[worker] ingested opportunity')
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function scanPair(connection: Connection, pair: WorkerPoolPair) {
  const label = pair.label ?? `${pair.poolA.slice(0, 4)}…/${pair.poolB.slice(0, 4)}…`
  const amount = pair.amountRaw ?? AMOUNT_RAW

  let res: Awaited<ReturnType<typeof compareDlmmPairPools>>
  try {
    res = await compareDlmmPairPools(connection, {
      poolA: new PublicKey(pair.poolA),
      poolB: new PublicKey(pair.poolB),
      startMint: new PublicKey(pair.startMint),
      startAmountIn: BigInt(amount),
    })
  } catch (e) {
    console.error(`[worker] pair ${label} quote error`, e)
    return
  }

  if (res.ok && res.opportunity) {
    const enriched = {
      ...res.opportunity,
      scannerLabel: label,
    }
    await postOpportunity(enriched)
    maybeLogExecutionPlan(enriched as LiveOpportunity)
  } else {
    console.log(`[worker] ${label} — no opportunity:`, res.abortReason)
  }
}

async function tick() {
  const pairs = loadPoolPairs()
  if (pairs.length === 0) {
    console.error(
      '[worker] No pool pairs: set POOL_PAIRS_FILE or POOL_PAIRS_JSON (array of {poolA,poolB,startMint}) or POOL_A + POOL_B + START_MINT'
    )
    return
  }

  const connection = createRpcConnection()
  console.log(`[worker] scanning ${pairs.length} pair(s)`)

  for (let i = 0; i < pairs.length; i++) {
    await scanPair(connection, pairs[i]!)
    if (PAIR_STAGGER_MS > 0 && i < pairs.length - 1) {
      await sleep(PAIR_STAGGER_MS)
    }
  }
}

async function main() {
  requireEnv('HELIUS_API_KEY', process.env.HELIUS_API_KEY)
  const pairs = loadPoolPairs()
  console.log(`[worker] ${pairs.length} pair(s) configured · poll ${POLL_MS}ms · stagger ${PAIR_STAGGER_MS}ms`)
  for (;;) {
    try {
      await tick()
    } catch (e) {
      console.error('[worker] tick error', e)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
