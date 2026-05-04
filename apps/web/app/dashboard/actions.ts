'use server'

import { PublicKey } from '@solana/web3.js'
import { compareDlmmPairPools, createRpcConnection } from '@solana-mev-bot/core'
import { prisma } from '@/lib/prisma'

export type SimulateResult =
  | { ok: true; message: string; projectedReturnX?: number; abortReason?: string }
  | { ok: false; error: string }

/**
 * Re-run the two-pool DLMM quote for an ingested row (same logic as the worker).
 * Needs `HELIUS_API_KEY` on the server and a payload with two `routeSteps` that include `pool` + `inMint` on hop 0.
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
  const steps = p.routeSteps
  if (!Array.isArray(steps) || steps.length < 2) {
    return {
      ok: false,
      error: 'Need ≥2 routeSteps with Meteora pools (worker-generated rows). Curl test rows may lack pools.',
    }
  }

  const s0 = steps[0] as Record<string, unknown>
  const s1 = steps[1] as Record<string, unknown>
  const poolA = s0.pool
  const poolB = s1.pool
  const startMint = s0.inMint

  if (typeof poolA !== 'string' || typeof poolB !== 'string' || typeof startMint !== 'string') {
    return { ok: false, error: 'routeSteps[0/1] must include pool (string) and hop0 inMint' }
  }

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
