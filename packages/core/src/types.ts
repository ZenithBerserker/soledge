import type { PublicKey } from '@solana/web3.js'

/** Priority band for triaging scanner hits */
export type OpportunityPriority = 'highest' | 'high' | 'medium' | 'low'

/** One hop on a Meteora DLMM pool */
export interface RouteStepMeteora {
  kind: 'meteora_dlmm'
  pool: string
  /** Mint flowing into this hop */
  inMint: string
  /** Mint flowing out */
  outMint: string
  inAmountRaw: string
  outAmountRaw: string
  impliedPriceImpactBps?: number
}

export interface LiveOpportunity {
  id: string
  detectedAt: string
  /** Human-readable pair labels (e.g. ANB/USDC) */
  pairs: string[]
  /** Best-effort: smaller clip sizes used for the quote */
  entryAmountLabel: string
  /** Multiplier on quoted round-trip (theoretical, pre-Jito) */
  projectedReturnX: number
  projectedProfitUsd?: number
  routeSteps: RouteStepMeteora[]
  recommendedJitoTipSol: number
  /** 0–1 based on pool liquidity, quote stability, blacklist passes */
  confidence: number
  priority: OpportunityPriority
  notes?: string[]
}

export interface ComparePoolsParams {
  poolA: PublicKey
  poolB: PublicKey
  /** Starting mint (e.g. USDC) */
  startMint: PublicKey
  /** Amount in smallest units (lamports / token decimals) */
  startAmountIn: bigint
}

export interface ComparePoolsResult {
  ok: boolean
  opportunity?: LiveOpportunity
  abortReason?: string
}
