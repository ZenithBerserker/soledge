import type { Prisma } from '@prisma/client'
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
  envNumber,
  type LiveOpportunity,
} from '@solana-mev-bot/core'
import { loadDiscoveryPairsForWeb } from '@/lib/discovery-pairs'
import { prisma } from '@/lib/prisma'

function discoveryEnabled(): boolean {
  const v = process.env.DISCOVERY_SCAN_ENABLED?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function maxPairs(): number {
  return Math.max(1, Math.min(50, Number(process.env.DISCOVERY_MAX_PAIRS_PER_SCAN) || 12))
}

function defaultAmountRaw(): string {
  return process.env.DISCOVERY_AMOUNT_RAW?.trim() || '25000'
}

function chaosMinMultiple(): number {
  const n = Number(process.env.DISCOVERY_MIN_PROFIT_MULTIPLE)
  return Number.isFinite(n) && n > 1 ? n : 1.03
}

function chaosAssumedLiqUsd(): number {
  return envNumber('DISCOVERY_ASSUMED_POOL_LIQ_USD', 35_000)
}

function enrichDiscoveryPayload(opp: LiveOpportunity, label: string): Record<string, unknown> {
  return {
    ...opp,
    scannerKind: 'discovery',
    scannerLabel: label,
    discoveryProfile: 'chaos-dlmm',
    notes: [
      ...(opp.notes ?? []),
      'Discovery scan: tiny clip + low profit floor — simulate before wallet/worker live.',
      'Not multi-hop; two DLMM pools only until graph routing exists.',
    ],
  }
}

export type DiscoveryScanResult =
  | { ok: true; scanned: number; ingested: number; errors: string[] }
  | { ok: false; error: string }

/**
 * Server-only: quote many two-pool pairs with a loose floor and ingest hits.
 */
export async function executeDiscoveryScan(): Promise<DiscoveryScanResult> {
  if (!discoveryEnabled()) {
    return {
      ok: false,
      error:
        'Set DISCOVERY_SCAN_ENABLED=1 on the server and define DISCOVERY_POOL_PAIRS_JSON or DISCOVERY_POOL_PAIRS_FILE.',
    }
  }

  if (!process.env.HELIUS_API_KEY?.trim()) {
    return { ok: false, error: 'HELIUS_API_KEY is not set on the server.' }
  }

  let pairs: ReturnType<typeof loadDiscoveryPairsForWeb>
  try {
    pairs = loadDiscoveryPairsForWeb()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid discovery pair list' }
  }

  if (pairs.length === 0) {
    return {
      ok: false,
      error:
        'No discovery pairs: set DISCOVERY_POOL_PAIRS_JSON (array) or DISCOVERY_POOL_PAIRS_FILE path.',
    }
  }

  const cap = maxPairs()
  const slice = pairs.slice(0, cap)
  const minM = chaosMinMultiple()
  const assumedLiq = chaosAssumedLiqUsd()
  const defaultAmt = defaultAmountRaw()

  const connection = createRpcConnection()
  let ingested = 0
  const errors: string[] = []

  for (const pair of slice) {
    const amount = pair.amountRaw?.trim() || defaultAmt
    let startIn: bigint
    try {
      startIn = BigInt(amount)
    } catch {
      errors.push(`${pair.label ?? pair.poolA}: bad amountRaw`)
      continue
    }

    try {
      const res = await compareDlmmPairPools(
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

      if (res.ok && res.opportunity) {
        const label = pair.label ?? `discovery · ${pair.poolA.slice(0, 4)}…`
        const payload = JSON.parse(
          JSON.stringify(enrichDiscoveryPayload(res.opportunity, label))
        ) as Prisma.InputJsonValue
        await prisma.opportunityLog.create({ data: { payload } })
        ingested++
      }
    } catch (e) {
      errors.push(`${pair.label ?? pair.poolA}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { ok: true, scanned: slice.length, ingested, errors }
}
