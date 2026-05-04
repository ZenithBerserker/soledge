import type { LiveOpportunity } from '@solana-mev-bot/core'

/**
 * Execution track (Phase 2): today this only logs. LIVE mode is intentionally unimplemented — real bundles need
 * audited signing, key custody, and fee math.
 */
export function maybeLogExecutionPlan(opp: LiveOpportunity): void {
  const mode = (process.env.EXECUTION_MODE ?? 'off').toLowerCase()
  if (mode === 'off') return

  if (mode === 'simulate') {
    console.log('[execution] SIMULATE — would assemble Jito bundle for', opp.routeSteps?.length ?? 0, 'swap(s)')
    console.log('[execution] suggested tip SOL:', opp.recommendedJitoTipSol)
    console.log('[execution] pairs:', opp.pairs?.join(' · '), '· return x', opp.projectedReturnX)
    return
  }

  if (mode === 'live') {
    console.warn(
      '[execution] LIVE not implemented — add wallet + Meteora swap txs + Jito bundle submission after security review.'
    )
  }
}
