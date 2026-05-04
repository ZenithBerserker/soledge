'use server'

import { PublicKey } from '@solana/web3.js'
import { compareDlmmPairPools, createRpcConnection } from '@solana-mev-bot/core'
import { extractTwoPoolFromPayload, startAmountRawFromPayload } from '@/lib/extract-two-pool'
import { prisma } from '@/lib/prisma'

export type SimulateResult =
  | { ok: true; message: string; projectedReturnX?: number; abortReason?: string }
  | { ok: false; error: string }

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
  const extracted = extractTwoPoolFromPayload(p)
  if ('error' in extracted) {
    return { ok: false, error: extracted.error }
  }
  const { poolA, poolB, startMint } = extracted
  const startAmountIn = startAmountRawFromPayload(p)

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
