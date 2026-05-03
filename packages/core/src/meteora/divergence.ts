import DLMM from '@meteora-ag/dlmm'
import BN from 'bn.js'
import type { Connection, PublicKey } from '@solana/web3.js'
import { randomUUID } from 'crypto'
import {
  DEFAULT_MIN_PROFIT_MULTIPLE,
  PRIORITY_LIQ_USD_THRESHOLD,
  envNumber,
} from '../config'
import { assertMintAllowed, loadBlacklistFromEnv } from '../blacklist'
import { recommendedTipSol } from '../jito'
import type { ComparePoolsParams, ComparePoolsResult, LiveOpportunity, RouteStepMeteora } from '../types'
import { quoteHop } from './quote'

function labelMint(pk: PublicKey): string {
  const s = pk.toBase58()
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

/**
 * Cross-pool arb for the *same two mints* on two different DLMM pools (e.g. different bin steps).
 * Path: startMint --poolA--> midMint --poolB--> startMint
 */
export async function compareDlmmPairPools(
  connection: Connection,
  params: ComparePoolsParams
): Promise<ComparePoolsResult> {
  const blocklist = loadBlacklistFromEnv()
  const minMult = envNumber('MIN_PROFIT_MULTIPLE', DEFAULT_MIN_PROFIT_MULTIPLE)

  try {
    assertMintAllowed(params.startMint, blocklist)

    const [pa, pb] = await DLMM.createMultiple(connection, [params.poolA, params.poolB])
    const mintSet = new Set([
      pa.tokenX.publicKey.toBase58(),
      pa.tokenY.publicKey.toBase58(),
      pb.tokenX.publicKey.toBase58(),
      pb.tokenY.publicKey.toBase58(),
    ])
    if (mintSet.size !== 2) {
      return { ok: false, abortReason: 'Pools do not share the same two-mint universe' }
    }

    const midMint =
      pa.tokenX.publicKey.equals(params.startMint) ? pa.tokenY.publicKey : pa.tokenX.publicKey

    assertMintAllowed(midMint, blocklist)

    const inBn = new BN(params.startAmountIn.toString())

    const hop1 = await quoteHop(pa, params.startMint, inBn)
    const hop2 = await quoteHop(pb, midMint, hop1.outAmount)
    const roundTripOut = hop2.outAmount

    const multiple = roundTripOut.mul(new BN(10_000)).div(inBn).toNumber() / 10_000
    if (!Number.isFinite(multiple) || multiple < minMult) {
      return {
        ok: false,
        abortReason: `Multiple ${multiple.toFixed(2)}x below threshold ${minMult}x`,
      }
    }

    const pairLabel = `${labelMint(midMint)}/${labelMint(params.startMint)}`
    const steps: RouteStepMeteora[] = [
      {
        kind: 'meteora_dlmm',
        pool: params.poolA.toBase58(),
        inMint: params.startMint.toBase58(),
        outMint: midMint.toBase58(),
        inAmountRaw: hop1.inAmount.toString(),
        outAmountRaw: hop1.outAmount.toString(),
        impliedPriceImpactBps: hop1.priceImpact ?? undefined,
      },
      {
        kind: 'meteora_dlmm',
        pool: params.poolB.toBase58(),
        inMint: midMint.toBase58(),
        outMint: params.startMint.toBase58(),
        inAmountRaw: hop2.inAmount.toString(),
        outAmountRaw: hop2.outAmount.toString(),
        impliedPriceImpactBps: hop2.priceImpact ?? undefined,
      },
    ]

    const tipSol = await recommendedTipSol(multiple)

    const roughLiqUsd = envNumber('ASSUMED_POOL_LIQ_USD', 50_000)
    const priority =
      roughLiqUsd < PRIORITY_LIQ_USD_THRESHOLD
        ? ('highest' as const)
        : ('high' as const)

    const opp: LiveOpportunity = {
      id: randomUUID(),
      detectedAt: new Date().toISOString(),
      pairs: [pairLabel],
      entryAmountLabel: `${params.startAmountIn.toString()} raw units start mint`,
      projectedReturnX: multiple,
      routeSteps: steps,
      recommendedJitoTipSol: tipSol,
      confidence: Math.min(0.95, 0.35 + Math.min(multiple / 2000, 0.5)),
      priority,
      notes: [
        'Quoted via DLMM bin liquidity (swapQuote); validate with simulateTransaction before sending bundles.',
        'Extreme multiples are often stale-bin artifacts — treat as hypothesis until simulated.',
      ],
    }

    return { ok: true, opportunity: opp }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, abortReason: msg }
  }
}
