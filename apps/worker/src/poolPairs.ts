import { existsSync, readFileSync } from 'fs'

export interface WorkerPoolPair {
  poolA: string
  poolB: string
  startMint: string
  /** Shown in logs / merged into ingest JSON as scannerLabel */
  label?: string
  /** Override global AMOUNT_RAW for this pair */
  amountRaw?: string
}

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {}
}

function parsePairEntry(raw: unknown, index: number, ctx: string): WorkerPoolPair {
  const o = asRecord(raw)
  const poolA = String(o.poolA ?? '').trim()
  const poolB = String(o.poolB ?? '').trim()
  const startMint = String(o.startMint ?? '').trim()
  const label = o.label != null ? String(o.label).trim() : undefined
  const amountRaw = o.amountRaw != null ? String(o.amountRaw).trim() : undefined

  if (!poolA || !poolB || !startMint) {
    throw new Error(`${ctx}[${index}] needs poolA, poolB, startMint (non-empty strings)`)
  }

  return { poolA, poolB, startMint, label, amountRaw }
}

/** Shared JSON-array parser for POOL_PAIRS_* and DISCOVERY_POOL_PAIRS_* */
export function parsePoolPairRows(parsed: unknown, ctx: string): WorkerPoolPair[] {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${ctx} must be a non-empty JSON array`)
  }
  return parsed.map((row, i) => parsePairEntry(row, i, ctx))
}

/**
 * Resolve list of two-pool configs: `POOL_PAIRS_FILE` → `POOL_PAIRS_JSON` → legacy `POOL_A`/`POOL_B`/`START_MINT`.
 */
export function loadPoolPairs(): WorkerPoolPair[] {
  const file = process.env.POOL_PAIRS_FILE?.trim()
  if (file) {
    if (!existsSync(file)) {
      throw new Error(`POOL_PAIRS_FILE not found: ${file}`)
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    return parsePoolPairRows(parsed, 'POOL_PAIRS_FILE')
  }

  const json = process.env.POOL_PAIRS_JSON?.trim()
  if (json) {
    const parsed = JSON.parse(json) as unknown
    return parsePoolPairRows(parsed, 'POOL_PAIRS_JSON')
  }

  const poolA = process.env.POOL_A?.trim()
  const poolB = process.env.POOL_B?.trim()
  const startMint = process.env.START_MINT?.trim()
  if (poolA && poolB && startMint) {
    return [{ poolA, poolB, startMint, label: 'POOL_A/B/MINT' }]
  }

  return []
}
