import DLMM from '@meteora-ag/dlmm'
import BN from 'bn.js'
import type { Connection, Keypair } from '@solana/web3.js'
import { PublicKey, Transaction } from '@solana/web3.js'
import { DEFAULT_BIN_ARRAY_COUNT, envNumber } from '../config'
import type { ComparePoolsParams } from '../types'
import {
  DEFAULT_JITO_BUNDLE_ENDPOINT,
  buildSolTipTransaction,
  encodeSignedTxBase58,
  fetchJitoTipAccounts,
  pickRandomTipAccount,
  sendJitoBundle,
} from '../jitoBundle'
import { prependComputeBudgetInstructions } from '../solana/computeBudget'
import { simulateTransactionOrSkip } from '../solana/simulate'
import { compareDlmmPairPools } from './divergence'
import { buildDlmmSwapTransaction, quoteHop } from './quote'

export interface BuiltTwoPoolRoundTrip {
  transaction: Transaction
  blockhash: string
  lastValidBlockHeight: number
  /** Bin-array pages used for both swap legs (smaller ⇒ smaller tx, may miss deep liquidity). */
  binArrayCountUsed: number
}

/** Legacy packet limit; reserve 1 × 64-byte signature for fee payer. */
const MAX_LEGACY_PACKET = 1232
const RESERVED_FOR_ONE_SIGNATURE = 64
const MAX_UNSIGNED_SERIALIZED_LEN = MAX_LEGACY_PACKET - RESERVED_FOR_ONE_SIGNATURE

function legacyTxWireLenPreSign(tx: Transaction): number {
  return tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  }).length
}

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
 * Builds one legacy transaction containing swap ix for pool A then pool B (same blockhash).
 * Decreases `binArrayCount` (min 3) until the serialized tx fits under the ~1232-byte wire limit
 * after the fee payer signature (fixes "Transaction too large: 1272 > 1232" in wallets).
 */
export async function buildTwoPoolRoundTripTransaction(
  connection: Connection,
  params: ComparePoolsParams,
  feePayer: PublicKey
): Promise<BuiltTwoPoolRoundTrip> {
  const [pa, pb] = await DLMM.createMultiple(connection, [params.poolA, params.poolB])
  await pa.refetchStates()
  await pb.refetchStates()

  assertSameTwoMints(pa, pb)

  const midMint = pa.tokenX.publicKey.equals(params.startMint)
    ? pa.tokenY.publicKey
    : pa.tokenX.publicKey

  const inBn = new BN(params.startAmountIn.toString())
  let binArrayCount = envNumber('METEORA_BIN_ARRAY_COUNT', DEFAULT_BIN_ARRAY_COUNT)
  const minBins = envNumber('METEORA_BIN_ARRAY_COUNT_MIN', 3)
  binArrayCount = Math.max(minBins, Math.min(binArrayCount, 32))

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

  let merged: Transaction = new Transaction()
  let wireLen = MAX_UNSIGNED_SERIALIZED_LEN + 1

  while (wireLen > MAX_UNSIGNED_SERIALIZED_LEN && binArrayCount >= minBins) {
    const hop1 = await quoteHop(pa, params.startMint, inBn, binArrayCount)
    await quoteHop(pb, midMint, hop1.outAmount, binArrayCount)

    const tx1 = await buildDlmmSwapTransaction(pa, params.startMint, inBn, feePayer, binArrayCount)
    const tx2 = await buildDlmmSwapTransaction(pb, midMint, hop1.outAmount, feePayer, binArrayCount)

    merged = new Transaction({
      feePayer,
      recentBlockhash: blockhash,
    })
    const swapIxs = [...tx1.instructions, ...tx2.instructions]
    const allIxs = prependComputeBudgetInstructions(swapIxs)
    for (const ix of allIxs) merged.add(ix)

    wireLen = legacyTxWireLenPreSign(merged)
    if (wireLen <= MAX_UNSIGNED_SERIALIZED_LEN) {
      return { transaction: merged, blockhash, lastValidBlockHeight, binArrayCountUsed: binArrayCount }
    }
    binArrayCount -= 1
  }

  throw new Error(
    `Merged DLMM round-trip too large for one legacy tx (~${wireLen} + ~${RESERVED_FOR_ONE_SIGNATURE}b sig > ${MAX_LEGACY_PACKET}). ` +
      `Tried binArrayCount down to ${minBins}. Lower METEORA_BIN_ARRAY_COUNT or use smaller / fewer bin accounts (pools); v0 + LUT not implemented yet.`
  )
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

async function sendSignedRpc(
  connection: Connection,
  signed: Transaction,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<string> {
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 5,
  })

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  )

  return sig
}

/**
 * Signs and submits merged round-trip via normal RPC (no Jito).
 */
export async function signAndSendTwoPoolRoundTrip(
  connection: Connection,
  signer: Keypair,
  params: ComparePoolsParams
): Promise<string> {
  await assertStillProfitable(connection, params)

  const built = await buildTwoPoolRoundTripTransaction(connection, params, signer.publicKey)
  built.transaction.sign(signer)

  await simulateTransactionOrSkip(connection, built.transaction)

  return sendSignedRpc(connection, built.transaction, built.blockhash, built.lastValidBlockHeight)
}

/**
 * Build merged DLMM round-trip for a wallet fee payer; optionally skip the same profit gate the worker uses.
 * Phantom/your wallet runs preflight simulation when you send.
 */
export async function prepareWalletTwoPoolRoundTrip(
  connection: Connection,
  params: ComparePoolsParams,
  feePayer: PublicKey,
  options: { skipProfitCheck?: boolean } = {}
): Promise<BuiltTwoPoolRoundTrip> {
  if (!options.skipProfitCheck) {
    await assertStillProfitable(connection, params)
  }
  return buildTwoPoolRoundTripTransaction(connection, params, feePayer)
}

/** Signs arb tx + SOL tip tx (tip last), submits bundle to Jito Block Engine. Returns bundle id. */
export async function sendTwoPoolRoundTripJitoBundle(
  connection: Connection,
  signer: Keypair,
  params: ComparePoolsParams,
  tipLamports: number,
  bundleEndpoint = process.env.JITO_BLOCK_ENGINE_URL?.trim() || DEFAULT_JITO_BUNDLE_ENDPOINT
): Promise<string> {
  await assertStillProfitable(connection, params)

  const built = await buildTwoPoolRoundTripTransaction(connection, params, signer.publicKey)
  built.transaction.sign(signer)

  await simulateTransactionOrSkip(connection, built.transaction)

  const tipDest = pickRandomTipAccount(await fetchJitoTipAccounts(bundleEndpoint))
  const tipTx = buildSolTipTransaction({
    from: signer.publicKey,
    to: tipDest,
    lamports: tipLamports,
    recentBlockhash: built.blockhash,
  })
  tipTx.sign(signer)

  const payload = [encodeSignedTxBase58(built.transaction), encodeSignedTxBase58(tipTx)]

  return sendJitoBundle(bundleEndpoint, payload)
}
