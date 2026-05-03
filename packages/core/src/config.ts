import BN from 'bn.js'

/** Risk caps (conservative capital — tune via env in worker) */
export const DEFAULT_MAX_INPUT_USDC = 50
export const DEFAULT_MAX_INPUT_SOL = 0.5

/** User rule: only surface when theoretical edge exceeds this multiple */
export const DEFAULT_MIN_PROFIT_MULTIPLE = 500

/** Abort quotes above this slippage (30% = 3000 bps if 10_000 = 100%) */
export const DEFAULT_MAX_SLIPPAGE_BPS = 3000

/** BN slippage passed into Meteora `swapQuote` */
export const SLIPPAGE_BN = new BN(DEFAULT_MAX_SLIPPAGE_BPS)

/** How many bin-array pages to walk for quotes */
export const DEFAULT_BIN_ARRAY_COUNT = 10

/** Tip band in SOL (scaled up with projected profit in worker) */
export const TIP_SOL_MIN = 0.5
export const TIP_SOL_MAX = 2

/** Treat pools below this USD liquidity as "new / thin" (rough heuristic) */
export const PRIORITY_LIQ_USD_THRESHOLD = 100_000

export function envNumber(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
