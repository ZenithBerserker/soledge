import DLMM from '@meteora-ag/dlmm'
import BN from 'bn.js'
import type { Connection, PublicKey } from '@solana/web3.js'
import {
  DEFAULT_BIN_ARRAY_COUNT,
  DEFAULT_MAX_SLIPPAGE_BPS,
  SLIPPAGE_BN,
  envNumber,
} from '../config'

function swapForYForHop(pool: DLMM, fromMint: PublicKey): boolean {
  const x = pool.tokenX.publicKey
  const y = pool.tokenY.publicKey
  if (fromMint.equals(x)) return true
  if (fromMint.equals(y)) return false
  throw new Error('Route mint is not part of this DLMM pair')
}

export interface HopQuote {
  inAmount: BN
  outAmount: BN
  priceImpact: number | null
  swapForY: boolean
}

export async function quoteHop(
  pool: DLMM,
  fromMint: PublicKey,
  inAmount: BN,
  binArrayCount = envNumber('METEORA_BIN_ARRAY_COUNT', DEFAULT_BIN_ARRAY_COUNT)
): Promise<HopQuote> {
  const swapForY = swapForYForHop(pool, fromMint)
  const binArrays = await pool.getBinArrayForSwap(swapForY, binArrayCount)
  const quote = pool.swapQuote(inAmount, swapForY, SLIPPAGE_BN, binArrays, true, 3)

  const impact =
    quote.priceImpact && typeof (quote.priceImpact as { toNumber?: () => number }).toNumber === 'function'
      ? (quote.priceImpact as { toNumber: () => number }).toNumber()
      : null

  if (impact !== null && impact > DEFAULT_MAX_SLIPPAGE_BPS) {
    throw new Error(`Slippage/price impact ${impact} bps exceeds ${DEFAULT_MAX_SLIPPAGE_BPS}`)
  }

  return {
    inAmount: quote.consumedInAmount,
    outAmount: quote.outAmount,
    priceImpact: impact,
    swapForY,
  }
}
