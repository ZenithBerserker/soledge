import { existsSync, readFileSync } from 'fs'
import { loadPoolPairs, parsePoolPairRows } from './poolPairs'

/**
 * Pair list for chaos discovery: mirror main POOL_PAIRS_* or DISCOVERY_POOL_PAIRS_*.
 */
export function loadDiscoveryPoolPairs(): ReturnType<typeof loadPoolPairs> {
  const mirror = process.env.DISCOVERY_MIRROR_POOL_PAIRS?.trim().toLowerCase()
  if (mirror === '1' || mirror === 'true' || mirror === 'yes') {
    return loadPoolPairs()
  }

  const file = process.env.DISCOVERY_POOL_PAIRS_FILE?.trim()
  if (file) {
    if (!existsSync(file)) {
      throw new Error(`DISCOVERY_POOL_PAIRS_FILE not found: ${file}`)
    }
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
    return parsePoolPairRows(parsed, 'DISCOVERY_POOL_PAIRS_FILE')
  }

  const json = process.env.DISCOVERY_POOL_PAIRS_JSON?.trim()
  if (json) {
    const parsed = JSON.parse(json) as unknown
    return parsePoolPairRows(parsed, 'DISCOVERY_POOL_PAIRS_JSON')
  }

  return []
}
