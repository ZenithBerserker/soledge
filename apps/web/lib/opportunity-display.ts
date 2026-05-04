/**
 * Normalize arbitrary ingest JSON for dashboard display (worker / curl shapes vary).
 */

function asRecord(p: unknown): Record<string, unknown> {
  return p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
}

export function pairsTitle(o: Record<string, unknown>): string {
  const p = o.pairs
  if (Array.isArray(p)) return (p as unknown[]).map(String).join(' · ')
  if (typeof p === 'string') return p
  if (typeof o.tokenPair === 'string') return o.tokenPair
  return 'Opportunity'
}

export function jitoTipDisplay(o: Record<string, unknown>): string {
  const v =
    o.recommendedJitoTipSol ?? o.jitoTipSol ?? o.jitoTipRecommended ?? o.jito_tip_sol ?? o.jitoTip
  if (v === undefined || v === null) return '—'
  return String(v)
}

export function confidenceDisplay(o: Record<string, unknown>): string {
  const v = o.confidence ?? o.confidenceLevel ?? o.confidence_score
  if (v === undefined || v === null) return '—'
  return String(v)
}

export function detectedDisplay(o: Record<string, unknown>, rowCreatedAt: Date): string {
  const v = o.detectedAt ?? o.createdAt
  if (v === undefined || v === null) {
    return rowCreatedAt.toISOString()
  }
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

export function routeStepLines(routeSteps: unknown): string[] {
  if (!Array.isArray(routeSteps)) return []
  return routeSteps.map((step, i) => {
    if (typeof step === 'string') return step
    if (step && typeof step === 'object' && !Array.isArray(step)) {
      const s = step as Record<string, unknown>
      const kind = s.kind != null ? String(s.kind) : 'hop'
      const pool = s.pool != null ? String(s.pool) : ''
      if (pool) return `${kind} · ${pool.slice(0, 16)}…`
      return kind
    }
    return `Step ${i + 1}`
  })
}

export function priorityBadge(o: Record<string, unknown>): string {
  const v = o.priority ?? o.confidenceLevel ?? ''
  return String(v ?? '')
}

export function payloadRecord(payload: unknown): Record<string, unknown> {
  return asRecord(payload)
}

/** Worker multi-pair ingest sets `scannerLabel` on the JSON payload. */
export function scannerLabelDisplay(o: Record<string, unknown>): string | null {
  const v = o.scannerLabel ?? o.pair_label ?? o.scanner_label
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim()
}

export function scannerKindDisplay(o: Record<string, unknown>): string | null {
  const v = o.scannerKind
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim()
}
