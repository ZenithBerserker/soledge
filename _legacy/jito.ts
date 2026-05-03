// apps/engine/src/services/jito.ts
// Jito Block Engine — bundle construction, tip auctions, dontfront protection

import {
  Connection, Transaction, TransactionInstruction,
  PublicKey, SystemProgram, Keypair, VersionedTransaction,
  TransactionMessage, ComputeBudgetProgram
} from '@solana/web3.js'

// Jito Block Engine endpoints
const JITO_BLOCK_ENGINE = 'https://mainnet.block-engine.jito.labs.io'
const JITO_TIP_API      = 'https://bundles.jito.wtf/api/v1/bundles/tip_floor'

// 8 Jito tip accounts — one selected randomly per bundle
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]

export interface TipFloor {
  p25: number; p50: number; p75: number; p95: number; p99: number
}

// ─── Tip management ───────────────────────────────────────────────────────

let tipCache: { data: TipFloor; ts: number } | null = null

export async function fetchTipFloor(): Promise<TipFloor> {
  // Cache for 5s
  if (tipCache && Date.now() - tipCache.ts < 5000) return tipCache.data

  const resp = await fetch(JITO_TIP_API)
  const [data] = await resp.json()

  const floor: TipFloor = {
    p25: Math.round(data.landed_tips_25th_percentile * 1e9),
    p50: Math.round(data.landed_tips_50th_percentile * 1e9),
    p75: Math.round(data.landed_tips_75th_percentile * 1e9),
    p95: Math.round(data.landed_tips_95th_percentile * 1e9),
    p99: Math.round(data.landed_tips_99th_percentile * 1e9),
  }
  tipCache = { data: floor, ts: Date.now() }
  return floor
}

/**
 * Calculate optimal tip for target percentile.
 * Uses EMA of last 10 samples for stability.
 */
const tipHistory: number[] = []
export async function calcOptimalTip(targetPercentile: 75 | 95 | 99 = 75): Promise<number> {
  const floor = await fetchTipFloor()
  const base = {
    75: floor.p75,
    95: floor.p95,
    99: floor.p99,
  }[targetPercentile]

  tipHistory.push(base)
  if (tipHistory.length > 10) tipHistory.shift()

  // EMA with alpha=0.3
  const ema = tipHistory.reduce((acc, v, i) => {
    const alpha = 0.3
    return i === 0 ? v : alpha * v + (1 - alpha) * acc
  })

  // Add 10% buffer to beat competition
  return Math.ceil(ema * 1.1)
}

// ─── Bundle construction ──────────────────────────────────────────────────

export interface BundleOptions {
  transactions: (Transaction | VersionedTransaction)[]
  payer: Keypair
  tip?: number                   // lamports; auto-calculated if omitted
  tipPercentile?: 75 | 95 | 99
  useJitoDontfront?: boolean     // sandwich protection
  bundleOnly?: boolean           // revert protection for single tx
}

export interface BundleResult {
  bundleId: string
  status: 'ACCEPTED' | 'REJECTED' | 'TIMEOUT'
  slot?: number
  error?: string
}

/**
 * Build and submit a Jito bundle.
 *
 * Critical implementation notes:
 * 1. Tip must be in the LAST transaction (not standalone) to prevent uncle-block tip theft
 * 2. jitodontfront must be at index 0 with overlapping signers for sandwich protection
 * 3. All txs must be signed before calling this function
 */
export async function submitBundle(opts: BundleOptions): Promise<BundleResult> {
  const {
    transactions,
    payer,
    tip,
    tipPercentile = 75,
    useJitoDontfront = true,
    bundleOnly = false,
  } = opts

  if (transactions.length === 0 || transactions.length > 5) {
    throw new Error('Bundle must contain 1-5 transactions')
  }

  const tipLamports = tip ?? await calcOptimalTip(tipPercentile)
  const tipAccount  = new PublicKey(JITO_TIP_ACCOUNTS[Math.floor(Math.random() * 8)])

  // Clone last transaction and append tip instruction
  let txList = [...transactions]
  const lastTx = txList[txList.length - 1]

  // Build tip instruction — must be embedded in core tx, NOT standalone
  const tipIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: tipAccount,
    lamports: tipLamports,
  })

  // Apply jitodontfront to first tx if requested
  if (useJitoDontfront && txList[0] instanceof Transaction) {
    const dontfrontKey = new PublicKey('jitodontfront111111111111111111111111111111')
    const firstTx = txList[0] as Transaction
    firstTx.add(new TransactionInstruction({
      keys: [{ pubkey: dontfrontKey, isSigner: false, isWritable: false }],
      programId: SystemProgram.programId,
      data: Buffer.alloc(0),
    }))
  }

  // Append tip to last transaction
  if (lastTx instanceof Transaction) {
    lastTx.add(tipIx)
    // Re-sign after mutation
    lastTx.sign(payer)
  }

  // Serialize all transactions
  const serialized = txList.map(tx => {
    if (tx instanceof VersionedTransaction) {
      return Buffer.from(tx.serialize()).toString('base64')
    }
    return tx.serialize().toString('base64')
  })

  // Submit to block engine
  try {
    const endpoint = bundleOnly
      ? `${JITO_BLOCK_ENGINE}/api/v1/transactions?bundleOnly=true`
      : `${JITO_BLOCK_ENGINE}/api/v1/bundles`

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.JITO_AUTH_TOKEN || ''}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serialized],
      }),
    })

    const body = await resp.json()

    if (body.error) {
      return { bundleId: '', status: 'REJECTED', error: body.error.message }
    }

    const bundleId: string = body.result
    return { bundleId, status: 'ACCEPTED' }
  } catch (err: any) {
    return { bundleId: '', status: 'REJECTED', error: err.message }
  }
}

// ─── Bundle status polling ────────────────────────────────────────────────

export async function pollBundleStatus(
  bundleId: string,
  maxWaitMs = 30_000
): Promise<'LANDED' | 'FAILED' | 'TIMEOUT'> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 500))
    try {
      const resp = await fetch(
        `${JITO_BLOCK_ENGINE}/api/v1/bundles?ids=${bundleId}`,
        { headers: { 'Authorization': `Bearer ${process.env.JITO_AUTH_TOKEN || ''}` } }
      )
      const data = await resp.json()
      const status = data[0]?.confirmation_status
      if (status === 'confirmed' || status === 'finalized') return 'LANDED'
      if (status === 'failed') return 'FAILED'
    } catch { /* retry */ }
  }
  return 'TIMEOUT'
}

// ─── Priority fee optimization ────────────────────────────────────────────

/**
 * For single-tx Jito submissions: 70% to Solana priority fee, 30% to Jito tip
 * For bundles: priority fee on constituent txs doesn't matter — only tip matters
 */
export function buildPriorityInstructions(
  totalBudgetLamports: number,
  isSingleTx: boolean
): TransactionInstruction[] {
  if (isSingleTx) {
    const priorityFee = Math.round(totalBudgetLamports * 0.7)
    const microLamports = Math.round(priorityFee / 200_000) // units
    return [ComputeBudgetProgram.setComputeUnitPrice({ microLamports })]
  }
  // For bundles, only compute limit matters (tip in final ix)
  return [ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })]
}
