/**
 * Jito Block Engine JSON-RPC — see https://github.com/jito-labs/mev-protos/blob/master/json_rpc/http.md
 * Bundles are submitted worker-side only (never from Vercel).
 */

import bs58 from 'bs58'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

export const DEFAULT_JITO_BUNDLE_ENDPOINT = 'https://mainnet.block-engine.jito.wtf/api/v1/bundles'

async function bundleRpc<T>(bundleEndpoint: string, method: string, params: unknown[]): Promise<T> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  const r = await fetch(bundleEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const j = (await r.json()) as { result?: T; error?: { message?: string }; id?: number }
  if (!r.ok) {
    throw new Error(`Jito HTTP ${r.status}: ${JSON.stringify(j)}`)
  }
  if (j.error?.message) {
    throw new Error(`Jito RPC error: ${j.error.message}`)
  }
  return j.result as T
}

export async function fetchJitoTipAccounts(bundleEndpoint: string): Promise<PublicKey[]> {
  const accounts = await bundleRpc<string[]>(bundleEndpoint, 'getTipAccounts', [])
  return accounts.map((s) => new PublicKey(s))
}

/** Serialized signed tx as base-58 string (per Jito sendBundle schema). */
export function encodeSignedTxBase58(tx: Transaction): string {
  return bs58.encode(tx.serialize())
}

export function pickRandomTipAccount(accounts: PublicKey[]): PublicKey {
  if (accounts.length === 0) throw new Error('No Jito tip accounts returned')
  return accounts[Math.floor(Math.random() * accounts.length)]!
}

export function buildSolTipTransaction(opts: {
  from: PublicKey
  to: PublicKey
  lamports: number
  recentBlockhash: string
}): Transaction {
  const tx = new Transaction({
    feePayer: opts.from,
    recentBlockhash: opts.recentBlockhash,
  })
  tx.add(
    SystemProgram.transfer({
      fromPubkey: opts.from,
      toPubkey: opts.to,
      lamports: opts.lamports,
    })
  )
  return tx
}

/** Submit bundle of signed txs (base-58 encoded wire txs). Returns bundle id from block engine. */
export async function sendJitoBundle(bundleEndpoint: string, txsBase58: string[]): Promise<string> {
  if (txsBase58.length < 1 || txsBase58.length > 5) {
    throw new Error('Jito bundle supports 1–5 transactions')
  }
  return bundleRpc<string>(bundleEndpoint, 'sendBundle', [txsBase58])
}

/** Poll bundle landing — same JSON-RPC endpoint as sendBundle. */
export async function getJitoBundleStatuses(
  bundleEndpoint: string,
  bundleIds: string[]
): Promise<unknown> {
  return bundleRpc<unknown>(bundleEndpoint, 'getBundleStatuses', [bundleIds])
}
