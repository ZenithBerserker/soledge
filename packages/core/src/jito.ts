/**
 * Jito tip floors + scaling helpers (bundles are submitted from the worker, not Vercel).
 */

const JITO_TIP_API = 'https://bundles.jito.wtf/api/v1/bundles/tip_floor'

export interface TipFloor {
  p25: number
  p50: number
  p75: number
  p95: number
  p99: number
}

let tipCache: { data: TipFloor; ts: number } | null = null

export async function fetchTipFloor(): Promise<TipFloor> {
  if (tipCache && Date.now() - tipCache.ts < 5000) return tipCache.data

  const resp = await fetch(JITO_TIP_API)
  const json = (await resp.json()) as Array<{
    landed_tips_25th_percentile?: number
    landed_tips_50th_percentile?: number
    landed_tips_75th_percentile?: number
    landed_tips_95th_percentile?: number
    landed_tips_99th_percentile?: number
  }>
  const data = json[0] ?? {}
  const floor: TipFloor = {
    p25: Math.round((data.landed_tips_25th_percentile ?? 0) * 1e9),
    p50: Math.round((data.landed_tips_50th_percentile ?? 0) * 1e9),
    p75: Math.round((data.landed_tips_75th_percentile ?? 0) * 1e9),
    p95: Math.round((data.landed_tips_95th_percentile ?? 0) * 1e9),
    p99: Math.round((data.landed_tips_99th_percentile ?? 0) * 1e9),
  }
  tipCache = { data: floor, ts: Date.now() }
  return floor
}

/**
 * Recommended aggressive tip in SOL given a projected edge multiple.
 * Still clamped to your strategy band; does not guarantee inclusion.
 */
export async function recommendedTipSol(projectedReturnX: number): Promise<number> {
  const floor = await fetchTipFloor()
  const p99Sol = floor.p99 / 1e9
  const scaled = Math.min(2, Math.max(0.5, 0.5 + Math.log10(Math.max(2, projectedReturnX)) * 0.35))
  const blended = Math.max(scaled, p99Sol * 0.9)
  return Math.round(blended * 1000) / 1000
}
