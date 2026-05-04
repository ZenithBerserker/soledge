/**
 * Worker entry — NOT for Vercel.
 *
 * WORKER_MODE=poll (default) — periodic DLMM two-pool scan (POOL_PAIRS_*).
 * WORKER_MODE=stream — Yellowstone gRPC txs mentioning Meteora LB CLMM program + optional STREAM_BRIDGE_* compare hook.
 * WORKER_MODE=both — poll loop + background gRPC stream.
 */
import { runPollForever } from './pollLoop'
import { runYellowstoneForever } from './stream/meteoraDlmmGrpc'

function requireEnv(name: string, v: string | undefined): string {
  if (!v?.trim()) throw new Error(`Missing env ${name}`)
  return v.trim()
}

function workerMode(): string {
  return (process.env.WORKER_MODE ?? 'poll').trim().toLowerCase()
}

function needsPoll(): boolean {
  const m = workerMode()
  return m === 'poll' || m === 'both'
}

function needsGrpc(): boolean {
  const m = workerMode()
  return m === 'stream' || m === 'both'
}

function grpcConfigured(): boolean {
  return !!(process.env.YELLOWSTONE_GRPC_URL?.trim() || process.env.GRPC_URL?.trim())
}

function bridgeConfigured(): boolean {
  return !!(process.env.STREAM_BRIDGE_POOL_A?.trim() && process.env.STREAM_BRIDGE_POOL_B?.trim() && process.env.STREAM_BRIDGE_START_MINT?.trim())
}

async function main(): Promise<void> {
  const mode = workerMode()
  console.log(`[worker] WORKER_MODE=${mode}`)

  if (!['poll', 'stream', 'both'].includes(mode)) {
    throw new Error(`WORKER_MODE must be poll | stream | both (got ${mode})`)
  }

  if (needsPoll()) {
    requireEnv('HELIUS_API_KEY', process.env.HELIUS_API_KEY)
  }

  if (needsGrpc()) {
    if (!grpcConfigured()) {
      throw new Error('Stream mode requires YELLOWSTONE_GRPC_URL or GRPC_URL')
    }
    if (bridgeConfigured()) {
      requireEnv('HELIUS_API_KEY', process.env.HELIUS_API_KEY)
    }
  }

  if (needsGrpc() && needsPoll()) {
    void runYellowstoneForever().catch((e) => console.error('[grpc] fatal background stream error', e))
    await runPollForever()
    return
  }

  if (needsGrpc()) {
    await runYellowstoneForever()
    return
  }

  await runPollForever()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
