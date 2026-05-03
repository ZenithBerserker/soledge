/**
 * Long-running process: NOT for Vercel. Run on a low-latency host near your RPC.
 * Set POOL_A, POOL_B (Meteora LB pair pubkeys), START_MINT, AMOUNT_RAW, poll interval, and DASHBOARD_URL to POST hits.
 */
import { PublicKey } from '@solana/web3.js'
import {
  compareDlmmPairPools,
  createRpcConnection,
} from '@solana-mev-bot/core'

const POOL_A = process.env.POOL_A
const POOL_B = process.env.POOL_B
const START_MINT = process.env.START_MINT
const AMOUNT_RAW = process.env.AMOUNT_RAW ?? '1000000'
const POLL_MS = Math.max(3_000, Number(process.env.POLL_MS) || 15_000)
const DASHBOARD_URL = process.env.DASHBOARD_URL
const INGEST_SECRET = process.env.ENGINE_INGEST_SECRET

function requireEnv(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

async function postOpportunity(body: object) {
  if (!DASHBOARD_URL || !INGEST_SECRET) {
    console.log('[worker] DASHBOARD_URL or ENGINE_INGEST_SECRET unset — logging only:')
    console.log(JSON.stringify(body, null, 2))
    return
  }
  const url = new URL('/api/opportunities', DASHBOARD_URL).toString()
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-engine-secret': INGEST_SECRET,
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    console.error('[worker] ingest failed', r.status, await r.text())
  } else {
    console.log('[worker] ingested opportunity')
  }
}

async function tick() {
  if (!POOL_A || !POOL_B || !START_MINT) {
    console.error(
      'Set POOL_A, POOL_B, START_MINT (and HELIUS_API_KEY) to run the two-pool comparison loop.'
    )
    return
  }

  const connection = createRpcConnection()
  const res = await compareDlmmPairPools(connection, {
    poolA: new PublicKey(POOL_A),
    poolB: new PublicKey(POOL_B),
    startMint: new PublicKey(START_MINT),
    startAmountIn: BigInt(AMOUNT_RAW),
  })

  if (res.ok && res.opportunity) {
    await postOpportunity(res.opportunity)
  } else {
    console.log('[worker] no opportunity:', res.abortReason)
  }
}

async function main() {
  requireEnv('HELIUS_API_KEY', process.env.HELIUS_API_KEY)
  console.log(`[worker] polling every ${POLL_MS}ms`)
  for (;;) {
    try {
      await tick()
    } catch (e) {
      console.error('[worker] tick error', e)
    }
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
