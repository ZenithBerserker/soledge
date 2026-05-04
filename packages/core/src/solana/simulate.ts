import type { Connection } from '@solana/web3.js'
import type { Transaction } from '@solana/web3.js'

/** Skip with EXECUTION_SKIP_SIMULATE=true or 1 (emergency only — unsafe). */
export async function simulateTransactionOrSkip(connection: Connection, tx: Transaction): Promise<void> {
  const skip = process.env.EXECUTION_SKIP_SIMULATE?.trim().toLowerCase()
  if (skip === '1' || skip === 'true' || skip === 'yes') return

  const sim = await connection.simulateTransaction(tx)

  if (sim.value.err) {
    const tail = sim.value.logs?.slice(-12) ?? []
    throw new Error(
      `simulateTransaction failed: ${JSON.stringify(sim.value.err)} · logs_tail=${JSON.stringify(tail)}`
    )
  }
}
