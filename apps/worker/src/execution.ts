import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import {
  createRpcConnection,
  sendTwoPoolRoundTripJitoBundle,
  signAndSendTwoPoolRoundTrip,
  type LiveOpportunity,
} from '@solana-mev-bot/core'

const LIVE_CONFIRM = 'I_UNDERSTAND_REAL_SOLANA_FUNDS_AND_SLIPPAGE'

function parseExecutorKeypair(): Keypair | null {
  const raw = process.env.EXECUTOR_SECRET_KEY?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return Keypair.fromSecretKey(Uint8Array.from(parsed.map((n) => Number(n))))
  } catch {
    return null
  }
}

async function executeLiveTwoPool(opp: LiveOpportunity): Promise<void> {
  if (process.env.EXECUTION_LIVE_CONFIRM?.trim() !== LIVE_CONFIRM) {
    console.error(`[execution] LIVE blocked: set EXECUTION_LIVE_CONFIRM=${LIVE_CONFIRM}`)
    return
  }

  const kp = parseExecutorKeypair()
  if (!kp) {
    console.error('[execution] EXECUTOR_SECRET_KEY must be a JSON byte array (solana-keygen export JSON secret)')
    return
  }

  const poolA = opp.poolA
  const poolB = opp.poolB
  const startMint = opp.startMint
  const startAmountRaw = opp.startAmountRaw ?? '1000000'

  if (!poolA || !poolB || !startMint) {
    console.error('[execution] Opportunity missing poolA / poolB / startMint — ingest from worker only')
    return
  }

  const connection = createRpcConnection()

  const params = {
    poolA: new PublicKey(poolA),
    poolB: new PublicKey(poolB),
    startMint: new PublicKey(startMint),
    startAmountIn: BigInt(startAmountRaw),
  }

  const submit = (process.env.EXECUTION_SUBMIT ?? 'rpc').toLowerCase()

  const minTip = Number(process.env.JITO_MIN_TIP_LAMPORTS ?? 1_000_000)
  const fromOpp = Math.floor((opp.recommendedJitoTipSol ?? 0) * LAMPORTS_PER_SOL)
  const tipLamports = Math.max(minTip, Number.isFinite(fromOpp) ? fromOpp : 0)

  if (submit === 'jito') {
    console.log('[execution] LIVE Jito bundle (arb tx + tip tx), tip lamports:', tipLamports)
    try {
      const bundleId = await sendTwoPoolRoundTripJitoBundle(connection, kp, params, tipLamports)
      console.log('[execution] Jito bundle id:', bundleId)
      return
    } catch (e) {
      const fb = (process.env.EXECUTION_JITO_FALLBACK_RPC ?? '').toLowerCase()
      if (fb !== 'true' && fb !== '1') {
        throw e
      }
      console.warn('[execution] Jito submit failed — EXECUTION_JITO_FALLBACK_RPC retry via RPC:', e)
      const sig = await signAndSendTwoPoolRoundTrip(connection, kp, params)
      console.log('[execution] RPC landed signature:', sig)
      return
    }
  }

  console.log('[execution] LIVE RPC send merged Meteora DLMM round-trip…')
  const sig = await signAndSendTwoPoolRoundTrip(connection, kp, params)
  console.log('[execution] LIVE landed signature:', sig)
}

/**
 * Worker-side execution only (never put EXECUTOR_SECRET_KEY on Vercel).
 * Use EXECUTION_SUBMIT=jito for Block Engine bundles (arb + SOL tip); EXECUTION_JITO_FALLBACK_RPC=true retries RPC on submit failure.
 */
export function maybeLogExecutionPlan(opp: LiveOpportunity): void {
  const mode = (process.env.EXECUTION_MODE ?? 'off').toLowerCase()
  if (mode === 'off') return

  const submit = (process.env.EXECUTION_SUBMIT ?? 'rpc').toLowerCase()

  if (mode === 'simulate') {
    console.log('[execution] SIMULATE submit=', submit, '— merged DLMM swap legs; tip SOL:', opp.recommendedJitoTipSol)
    console.log('[execution] pairs:', opp.pairs?.join(' · '), '· return x', opp.projectedReturnX)
    return
  }

  if (mode === 'live') {
    void executeLiveTwoPool(opp).catch((e) => console.error('[execution] LIVE error', e))
  }
}
