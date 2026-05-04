/**
 * Resolve pool addresses from an ingested opportunity payload (worker or enriched row).
 */
export type TwoPoolFields = { poolA: string; poolB: string; startMint: string }

export function extractTwoPoolFromPayload(p: Record<string, unknown>): TwoPoolFields | { error: string } {
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
      'Need Meteora LB addresses on this row: poolA, poolB, startMint (same as worker POOL_* / START_MINT), or worker routeSteps objects with pool + inMint. Run npm run db:enrich-pools from repo root or ingest from the worker — route labels alone are not enough.',
  }
}

export function startAmountRawFromPayload(p: Record<string, unknown>): bigint {
  const raw = p.startAmountRaw ?? p.amountRaw ?? p.entryAmountRaw
  try {
    return raw != null ? BigInt(String(raw)) : BigInt(1_000_000)
  } catch {
    return BigInt(1_000_000)
  }
}
