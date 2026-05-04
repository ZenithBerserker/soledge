/**
 * Chaos discovery: same two-pool DLMM quote path as poll, but lower profit floor + tiny clips.
 * Does not crawl chain for “new pools” — supply pairs via DISCOVERY_POOL_PAIRS_* or mirror POOL_PAIRS_*.
 */
import type { Connection } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
  envNumber,
  type LiveOpportunity,
} from '@solana-mev-bot/core'
import { loadDiscoveryPoolPairs } from './discoveryPairs'
import type { WorkerPoolPair } from './poolPairs'
import { maybeLogExecutionPlan } from './execution'
import { postOpportunity } from './ingest'

const DISCOVERY_POLL_MS = Math.max(0, Number(process.env.DISCOVERY_POLL_MS) || 0)
const PAIR_STAGGER_MS = Math.max(0, Number(process.env.DISCOVERY_PAIR_STAGGER_MS) || 150)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function chaosMinMultiple(): number {
  const n = Number(process.env.DISCOVERY_MIN_PROFIT_MULTIPLE)
  return Number.isFinite(n) && n > 1 ? n : 1.03
}

function defaultAmountRaw(): string {
  return process.env.DISCOVERY_AMOUNT_RAW?.trim() || '25000'
}

function enrichDiscoveryPayload(opp: LiveOpportunity, label: string): Record<string, unknown> {
  return {
    ...opp,
    scannerKind: 'discovery',
    scannerLabel: label,
    discoveryProfile: 'chaos-dlmm',
    notes: [
      ...(opp.notes ?? []),
      'Discovery worker: tiny clip + low floor — simulate before live.',
      'Two DLMM hops only; multi-hop routing not wired.',
    ],
  }
}

async function scanDiscoveryPair(connection: Connection, pair: WorkerPoolPair): Promise<void> {
  const label = pair.label ?? `${pair.poolA.slice(0, 4)}…/${pair.poolB.slice(0, 4)}…`
  const amount = pair.amountRaw?.trim() || defaultAmountRaw()
  let startIn: bigint
  try {
    startIn = BigInt(amount)
  } catch {
    console.error(`[discovery] bad amountRaw for ${label}`)
    return
  }

  const minM = chaosMinMultiple()
  const assumedLiq = envNumber('DISCOVERY_ASSUMED_POOL_LIQ_USD', 35_000)

  let res: Awaited<ReturnType<typeof compareDlmmPairPools>>
  try {
    res = await compareDlmmPairPools(
      connection,
      {
        poolA: new PublicKey(pair.poolA),
        poolB: new PublicKey(pair.poolB),
        startMint: new PublicKey(pair.startMint),
        startAmountIn: startIn,
      },
      {
        minProfitMultiple: minM,
        assumedPoolLiqUsd: assumedLiq,
      }
    )
  } catch (e) {
    console.error(`[discovery] ${label} quote error`, e)
    return
  }

  if (res.ok && res.opportunity) {
    const enriched = enrichDiscoveryPayload(res.opportunity, label)
    await postOpportunity(enriched)
    const trigger =
      process.env.DISCOVERY_TRIGGER_EXECUTION?.trim().toLowerCase() === '1' ||
      process.env.DISCOVERY_TRIGGER_EXECUTION?.trim().toLowerCase() === 'true'
    if (trigger) {
      maybeLogExecutionPlan(res.opportunity)
    }
    console.log(`[discovery] ingested ${label} · ~${res.opportunity.projectedReturnX}x`)
  }
}

async function tick(): Promise<void> {
  const pairs = loadDiscoveryPoolPairs()
  if (pairs.length === 0) {
    console.warn('[discovery] No pairs — set DISCOVERY_MIRROR_POOL_PAIRS=true or DISCOVERY_POOL_PAIRS_JSON / FILE')
    return
  }

  const connection = createRpcConnection()
  console.log(`[discovery] scanning ${pairs.length} pair(s) · floor ${chaosMinMultiple()}x`)

  for (let i = 0; i < pairs.length; i++) {
    await scanDiscoveryPair(connection, pairs[i]!)
    if (PAIR_STAGGER_MS > 0 && i < pairs.length - 1) {
      await sleep(PAIR_STAGGER_MS)
    }
  }
}

export async function runDiscoveryForever(): Promise<void> {
  if (DISCOVERY_POLL_MS <= 0) {
    console.warn('[discovery] DISCOVERY_POLL_MS unset — discovery loop disabled')
    return
  }

  console.log(
    `[discovery] ENABLED · interval ${DISCOVERY_POLL_MS}ms · stagger ${PAIR_STAGGER_MS}ms · execution hook=${process.env.DISCOVERY_TRIGGER_EXECUTION ?? 'false'}`
  )

  for (;;) {
    try {
      await tick()
    } catch (e) {
      console.error('[discovery] tick error', e)
    }
    await sleep(DISCOVERY_POLL_MS)
  }
}
