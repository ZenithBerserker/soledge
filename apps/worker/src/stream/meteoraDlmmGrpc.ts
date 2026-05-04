/**
 * Yellowstone / Geyser gRPC — subscribe to txs mentioning Meteora DLMM (LB CLMM) program.
 * Uses @triton-one/yellowstone-grpc — point GRPC at your provider (Helius Dragon's Mouth, Triton, etc.).
 *
 * Optional bridge: when STREAM_BRIDGE_POOL_A appears in parsed account keys, run compareDlmmPairPools vs fixed POOL_B/MINT (cooldown-guarded).
 */

import bs58 from 'bs58'
import Client, {
  CommitmentLevel,
  txEncode,
  type SubscribeRequest,
  type SubscribeUpdate,
} from '@triton-one/yellowstone-grpc'
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
  type LiveOpportunity,
} from '@solana-mev-bot/core'
import { maybeLogExecutionPlan } from '../execution'
import { postOpportunity } from '../ingest'

/** Mainnet Meteora DLMM program (LB CLMM). Override via STREAM_METEORA_PROGRAM_ID if needed. */
export const DEFAULT_METEORA_LB_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Best-effort pubkey extraction from JsonParsed Yellowstone payload (nested `pubkey` fields + common arrays). */
export function collectLikelyPubkeys(parsed: unknown): string[] {
  const found = new Set<string>()
  const base58ish = /^[1-9A-HJ-NP-Za-km-z]{32,48}$/

  const visit = (v: unknown): void => {
    if (typeof v === 'string') {
      if (base58ish.test(v)) found.add(v)
      return
    }
    if (!v || typeof v !== 'object') return
    if (Array.isArray(v)) {
      for (const x of v) visit(x)
      return
    }
    const o = v as Record<string, unknown>
    const pk = o.pubkey
    if (typeof pk === 'string' && base58ish.test(pk)) found.add(pk)
    for (const k of Object.keys(o)) {
      if (k === 'pubkey') continue
      visit(o[k])
    }
  }

  visit(parsed)
  return [...found]
}

function grpcEndpoint(): string | undefined {
  const u = process.env.YELLOWSTONE_GRPC_URL?.trim() || process.env.GRPC_URL?.trim()
  return u || undefined
}

function grpcToken(): string | undefined {
  return process.env.GRPC_X_TOKEN?.trim() || process.env.X_TOKEN?.trim() || undefined
}

let lastBridgeAt = 0

async function maybeRunBridgeCompare(accountKeys: string[], signature: string, slot: string): Promise<void> {
  const poolA = process.env.STREAM_BRIDGE_POOL_A?.trim()
  const poolB = process.env.STREAM_BRIDGE_POOL_B?.trim()
  const startMint = process.env.STREAM_BRIDGE_START_MINT?.trim()
  if (!poolA || !poolB || !startMint) return

  if (!accountKeys.includes(poolA)) return

  const cooldown = Math.max(0, Number(process.env.STREAM_BRIDGE_COOLDOWN_MS ?? 8000))
  const now = Date.now()
  if (cooldown > 0 && now - lastBridgeAt < cooldown) return
  lastBridgeAt = now

  const amountRaw = process.env.STREAM_BRIDGE_AMOUNT_RAW?.trim() || process.env.AMOUNT_RAW || '1000000'

  console.log(`[grpc] bridge compare · sig=${signature.slice(0, 16)}… · slot=${slot} · poolA(trigger)=${poolA.slice(0, 8)}…`)

  const connection = createRpcConnection()
  let res: Awaited<ReturnType<typeof compareDlmmPairPools>>
  try {
    res = await compareDlmmPairPools(connection, {
      poolA: new PublicKey(poolA),
      poolB: new PublicKey(poolB),
      startMint: new PublicKey(startMint),
      startAmountIn: BigInt(amountRaw),
    })
  } catch (e) {
    console.error('[grpc] bridge quote error', e)
    return
  }

  if (res.ok && res.opportunity) {
    const enriched = {
      ...res.opportunity,
      scannerKind: 'grpc-bridge',
      scannerLabel: `grpc:${poolA.slice(0, 6)}…/${poolB.slice(0, 6)}…`,
      grpcTriggerSig: signature,
      grpcTriggerSlot: slot,
    }
    await postOpportunity(enriched)
    maybeLogExecutionPlan(enriched as LiveOpportunity)
  } else {
    console.log('[grpc] bridge — no opportunity:', res.abortReason)
  }
}

export async function runYellowstoneSessionOnce(): Promise<void> {
  const endpoint = grpcEndpoint()
  if (!endpoint) {
    throw new Error('Set YELLOWSTONE_GRPC_URL or GRPC_URL for stream mode')
  }

  const token = grpcToken()
  const programId = process.env.STREAM_METEORA_PROGRAM_ID?.trim() || DEFAULT_METEORA_LB_PROGRAM_ID

  const txFilter = {
    meteora_lb_clmm: {
      vote: false,
      failed: false,
      accountInclude: [programId],
      accountExclude: [] as string[],
      accountRequired: [] as string[],
    },
  }

  const client = new Client(endpoint, token, undefined)

  console.log(`[grpc] connecting · filter accountInclude=${programId.slice(0, 8)}…`)

  const stream = await client.subscribeOnce(
    {},
    {},
    txFilter,
    {},
    {},
    {},
    {},
    CommitmentLevel.CONFIRMED,
    []
  )

  const verbose = ['1', 'true', 'yes'].includes((process.env.STREAM_VERBOSE ?? '').toLowerCase())
  let txCount = 0

  await new Promise<void>((resolve, reject) => {
    stream.on('error', (err: Error) => reject(err))
    stream.on('end', () => resolve())
    stream.on('close', () => resolve())

    stream.on('data', (update: SubscribeUpdate) => {
      void (async () => {
        try {
          if (update.ping != null) {
            const ack: SubscribeRequest = {
              accounts: {},
              slots: {},
              transactions: txFilter,
              transactionsStatus: {},
              blocks: {},
              blocksMeta: {},
              entry: {},
              commitment: CommitmentLevel.CONFIRMED,
              accountsDataSlice: [],
              ping: { id: Date.now() % 2147483647 },
            }
            stream.write(ack, (err: Error | undefined) => {
              if (err) console.error('[grpc] ping ack write failed', err)
            })
            return
          }

          const wrap = update.transaction
          const info = wrap?.transaction
          if (!info) return

          txCount++
          const signature = bs58.encode(info.signature)

          let parsed: unknown = null
          try {
            parsed = txEncode.encode(info, txEncode.encoding.JsonParsed, undefined, false)
          } catch {
            parsed = null
          }

          const keys = parsed ? collectLikelyPubkeys(parsed) : []

          if (verbose) {
            console.log(
              `[grpc] tx #${txCount} sig=${signature.slice(0, 12)}… slot=${wrap.slot} keys=${keys.length}`
            )
          } else if (txCount % 200 === 0) {
            console.log(`[grpc] … ${txCount} meteora txs processed`)
          }

          await maybeRunBridgeCompare(keys, signature, wrap.slot)
        } catch (e) {
          console.error('[grpc] data handler error', e)
        }
      })()
    })
  })
}

/** Reconnecting loop until process exit. */
export async function runYellowstoneForever(): Promise<void> {
  let backoffMs = 3000

  for (;;) {
    try {
      await runYellowstoneSessionOnce()
      console.warn('[grpc] session ended — reconnecting shortly')
      backoffMs = 3000
    } catch (e) {
      console.error('[grpc] session error — backoff', backoffMs, 'ms', e)
      await sleep(backoffMs)
      backoffMs = Math.min(backoffMs * 2, 120_000)
    }

    await sleep(750)
  }
}
