'use server'

import { PublicKey } from '@solana/web3.js'
import { compareDlmmPairPools, createRpcConnection } from '@solana-mev-bot/core'
import { prisma } from '@/lib/prisma'

export type SimulateResult =
  | { ok: true; message: string; projectedReturnX?: number; abortReason?: string }
  | { ok: false; error: string }

type Pools = { poolA: string; poolB: string; startMint: string }

/**
 * Accept either:
 * - Root fields `poolA`, `poolB`, `startMint` (base58) — good for manual/curl rows with string `routeSteps`
 * - Worker shape: `routeSteps` = [{ pool, inMint, outMint }, ...] (objects) on first two hops
 */
function extractTwoPoolQuote(p: Record<string, unknown>): Pools | { error: string } {
  if (
    typeof p.poolA === 'string' &&
    typeof p.poolB === 'string' &&
    typeof p.startMint === 'string'
  ) {
    return { poolA: p.poolA, poolB: p.poolB, startMint: p.startMint }
  }

  const steps = p.routeSteps
  if (Array.isArray(steps) && steps.length >= 2) {
    const s0 = steps[0]
    const s1 = steps[1]
    if (
      typeof s0 === 'object' &&
      s0 !== null &&
      typeof s1 === 'object' &&
      s1 !== null &&
      !Array.isArray(s0) &&
      !Array.isArray(s1)
    ) {
      const a = s0 as Record<string, unknown>
      const b = s1 as Record<string, unknown>
      if (typeof a.pool === 'string' && typeof b.pool === 'string' && typeof a.inMint === 'string') {
        return { poolA: a.pool, poolB: b.pool, startMint: a.inMint }
      }
    }
  }

  return {
    error:
      'Need Meteora LB pair addresses. Add to this row JSON: "poolA":"<base58>","poolB":"<base58>","startMint":"<base58>" (same as worker env POOL_A/POOL_B/START_MINT), OR ingest from the worker so routeSteps are objects with pool + inMint. Pretty labels like USDC→SOL are not enough to re-quote on-chain.',
  }
}

/**
 * Re-run the two-pool DLMM quote for an ingested row (same logic as the worker).
 */
export async function simulateSnipe(logId: string): Promise<SimulateResult> {
  if (!logId || logId.length < 8) {
    return { ok: false, error: 'Invalid id' }
  }

  if (!process.env.HELIUS_API_KEY?.trim()) {
    return { ok: false, error: 'HELIUS_API_KEY is not set (add to apps/web .env.local and Vercel for simulate)' }
  }

  const row = await prisma.opportunityLog.findUnique({ where: { id: logId } })
  if (!row) {
    return { ok: false, error: 'Opportunity not found' }
  }

  const p = row.payload as Record<string, unknown>
  const extracted = extractTwoPoolQuote(p)
  if ('error' in extracted) {
    return { ok: false, error: extracted.error }
  }
  const { poolA, poolB, startMint } = extracted

  const raw = p.startAmountRaw ?? p.amountRaw ?? p.entryAmountRaw
  let startAmountIn: bigint
  try {
    startAmountIn = raw != null ? BigInt(String(raw)) : BigInt(1_000_000)
  } catch {
    startAmountIn = BigInt(1_000_000)
  }

  try {
    const connection = createRpcConnection()
    const res = await compareDlmmPairPools(connection, {
      poolA: new PublicKey(poolA),
      poolB: new PublicKey(poolB),
      startMint: new PublicKey(startMint),
      startAmountIn,
    })

    if (res.ok && res.opportunity) {
      return {
        ok: true,
        message: 'Fresh on-chain quote',
        projectedReturnX: res.opportunity.projectedReturnX,
      }
    }

    return {
      ok: true,
      message: 'Quoted but below threshold or aborted',
      abortReason: res.abortReason,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Simulation failed' }
  }
}
