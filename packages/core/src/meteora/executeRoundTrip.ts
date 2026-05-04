import DLMM from '@meteora-ag/dlmm'
import BN from 'bn.js'
import type { Connection, Keypair } from '@solana/web3.js'
import { PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import type { ComparePoolsParams } from '../types'
import { compareDlmmPairPools } from './divergence'
import { buildDlmmSwapTransaction, quoteHop } from './quote'

function assertSameTwoMints(pa: DLMM, pb: DLMM): void {
  const mintSet = new Set([
    pa.tokenX.publicKey.toBase58(),
    pa.tokenY.publicKey.toBase58(),
    pb.tokenX.publicKey.toBase58(),
    pb.tokenY.publicKey.toBase58(),
  ])
  if (mintSet.size !== 2) {
    throw new Error('Pools do not share the same two-mint universe')
  }
}

/**
 * Builds one legacy transaction containing swap ix for pool A then pool B (atomicity vs RPC broadcast only —
 * still loses to faster bots; does not submit Jito bundles).
 */
export async function buildTwoPoolRoundTripTransaction(
  connection: Connection,
  params: ComparePoolsParams,
  feePayer: PublicKey
): Promise<Transaction> {
  const [pa, pb] = await DLMM.createMultiple(connection, [params.poolA, params.poolB])
  await pa.refetchStates()
  await pb.refetchStates()

  assertSameTwoMints(pa, pb)

  const midMint = pa.tokenX.publicKey.equals(params.startMint)
    ? pa.tokenY.publicKey
    : pa.tokenX.publicKey

  const inBn = new BN(params.startAmountIn.toString())
  const hop1 = await quoteHop(pa, params.startMint, inBn)
  await quoteHop(pb, midMint, hop1.outAmount)

  const tx1 = await buildDlmmSwapTransaction(pa, params.startMint, inBn, feePayer)
  const tx2 = await buildDlmmSwapTransaction(pb, midMint, hop1.outAmount, feePayer)

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  const merged = new Transaction({
    feePayer,
    recentBlockhash: blockhash,
  })

  for (const ix of tx1.instructions) merged.add(ix)
  for (const ix of tx2.instructions) merged.add(ix)

  void lastValidBlockHeight
  return merged
}

/** Re-quote with threshold from env; throw if below MIN_PROFIT_MULTIPLE or abort. */
export async function assertStillProfitable(
  connection: Connection,
  params: ComparePoolsParams
): Promise<void> {
  const res = await compareDlmmPairPools(connection, params)
  if (!res.ok || !res.opportunity) {
    throw new Error(res.abortReason ?? 'Opportunity below MIN_PROFIT_MULTIPLE or quote failed')
  }
}

/**
 * Signs and submits merged round-trip swap tx. Can revert on-chain; can lose funds to fees and adverse execution.
 */
export async function signAndSendTwoPoolRoundTrip(
  connection: Connection,
  signer: Keypair,
  params: ComparePoolsParams
): Promise<string> {
  await assertStillProfitable(connection, params)

  const tx = await buildTwoPoolRoundTripTransaction(connection, params, signer.publicKey)

  const sig = await sendAndConfirmTransaction(connection, tx, [signer], {
    commitment: 'confirmed',
    skipPreflight: false,
    maxRetries: 5,
  })

  return sig
}
