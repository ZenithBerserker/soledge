import { ComputeBudgetProgram, TransactionInstruction } from '@solana/web3.js'
import { envNumber } from '../config'

/**
 * Prepends compute-unit limit + priority fee (micro-lamports per CU) when env sets them — matches common sniper-bot patterns.
 * Set PRIORITY_FEE_MICRO_LAMPORTS=0 to omit price ix only; COMPUTE_UNIT_LIMIT=0 to omit limit ix only.
 */
export function prependComputeBudgetInstructions(base: TransactionInstruction[]): TransactionInstruction[] {
  const cuLimit = envNumber('COMPUTE_UNIT_LIMIT', 1_400_000)
  const microPrice = envNumber('PRIORITY_FEE_MICRO_LAMPORTS', 0)

  const extra: TransactionInstruction[] = []
  if (cuLimit > 0) {
    extra.push(ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }))
  }
  if (microPrice > 0) {
    extra.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor(microPrice),
      })
    )
  }

  return [...extra, ...base]
}
