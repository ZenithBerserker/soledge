import { existsSync, readFileSync } from 'fs'

export type DiscoveryPair = {
  poolA: string
  poolB: string
  startMint: string
  label?: string
  amountRaw?: string
}

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {}
}

function parseEntry(raw: unknown, index: number): DiscoveryPair {
  const o = asRecord(raw)
  const poolA = String(o.poolA ?? '').trim()
  const poolB = String(o.poolB ?? '').trim()
  const startMint = String(o.startMint ?? '').trim()
  const label = o.label != null ? String(o.label).trim() : undefined
  const amountRaw = o.amountRaw != null ? String(o.amountRaw).trim() : undefined

  if (!poolA || !poolB || !startMint) {
    throw new Error(`DISCOVERY_POOL_PAIRS_JSON[${index}] needs poolA, poolB, startMint`)
  }

  return { poolA, poolB, startMint, label, amountRaw }
}

/**
 * Discovery pair list for dashboard scans: DISCOVERY_POOL_PAIRS_FILE → DISCOVERY_POOL_PAIRS_JSON.
 */
export function loadDiscoveryPairsForWeb(): DiscoveryPair[] {
  const file = process.env.DISCOVERY_POOL_PAIRS_FILE?.trim()
  if (file) {
    if (!existsSync(file)) {
      throw new Error(`DISCOVERY_POOL_PAIRS_FILE not found: ${file}`)
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('DISCOVERY_POOL_PAIRS_FILE must contain a non-empty JSON array')
    }
    return parsed.map((row, i) => parseEntry(row, i))
  }

  const json = process.env.DISCOVERY_POOL_PAIRS_JSON?.trim()
  if (json) {
    const parsed = JSON.parse(json) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('DISCOVERY_POOL_PAIRS_JSON must be a non-empty JSON array')
    }
    return parsed.map((row, i) => parseEntry(row, i))
  }

  return []
}
