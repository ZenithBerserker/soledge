/**
 * Periodic DLMM two-pool polling (POOL_PAIRS_* / legacy POOL_A/B/MINT).
 */
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
  type LiveOpportunity,
} from '@solana-mev-bot/core'
import { maybeLogExecutionPlan } from './execution'
import { postOpportunity } from './ingest'
import { loadPoolPairs, type WorkerPoolPair } from './poolPairs'

const AMOUNT_RAW = process.env.AMOUNT_RAW ?? '1000000'
const POLL_MS = Math.max(3_000, Number(process.env.POLL_MS) || 15_000)
const PAIR_STAGGER_MS = Math.max(0, Number(process.env.PAIR_STAGGER_MS) || 250)

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
      scannerKind: 'poll',
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

export async function runPollForever(): Promise<void> {
  const pairs = loadPoolPairs()
  console.log(`[worker] POLL · ${pairs.length} pair(s) · interval ${POLL_MS}ms · stagger ${PAIR_STAGGER_MS}ms`)

  for (;;) {
    try {
      await tick()
    } catch (e) {
      console.error('[worker] tick error', e)
    }
    await sleep(POLL_MS)
  }
}
