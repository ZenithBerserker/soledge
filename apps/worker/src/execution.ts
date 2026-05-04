import { Keypair, PublicKey } from '@solana/web3.js'
import { createRpcConnection, signAndSendTwoPoolRoundTrip, type LiveOpportunity } from '@solana-mev-bot/core'

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

  console.log('[execution] LIVE sending merged Meteora DLMM round-trip (no Jito bundle)…')

  const sig = await signAndSendTwoPoolRoundTrip(connection, kp, {
    poolA: new PublicKey(poolA),
    poolB: new PublicKey(poolB),
    startMint: new PublicKey(startMint),
    startAmountIn: BigInt(startAmountRaw),
  })

  console.log('[execution] LIVE landed signature:', sig)
}

/**
 * Worker-side execution only (never put EXECUTOR_SECRET_KEY on Vercel).
 * LIVE merges two DLMM swaps into one legacy transaction and submits via RPC — competitive arbs usually need Jito + lower latency.
 */
export function maybeLogExecutionPlan(opp: LiveOpportunity): void {
  const mode = (process.env.EXECUTION_MODE ?? 'off').toLowerCase()
  if (mode === 'off') return

  if (mode === 'simulate') {
    console.log('[execution] SIMULATE — would build merged DLMM swap tx (2 legs), suggested tip SOL:', opp.recommendedJitoTipSol)
    console.log('[execution] pairs:', opp.pairs?.join(' · '), '· return x', opp.projectedReturnX)
    return
  }

  if (mode === 'live') {
    void executeLiveTwoPool(opp).catch((e) => console.error('[execution] LIVE error', e))
  }
}
