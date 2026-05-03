// apps/engine/src/services/helius.ts
// Helius RPC client — token launches, account subscriptions, archival data

import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js'
import { TokenSignal, SafetyChecks, MarketData } from '@soledge/types'

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
const HELIUS_WS  = `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`

// Raydium AMM v4 program
const RAYDIUM_AMM_V4 = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
// SPL Token program
const TOKEN_PROGRAM   = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
// Pump.fun bonding curve
const PUMPFUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')

export const connection = new Connection(HELIUS_RPC, {
  commitment: 'confirmed',
  wsEndpoint: HELIUS_WS,
})

// ─── Real-time pool detection ──────────────────────────────────────────────

export async function subscribeRaydiumLaunches(
  onNewPool: (mintAddress: string, poolAddress: string, slot: number) => void
): Promise<number> {
  const subId = connection.onProgramAccountChange(
    RAYDIUM_AMM_V4,
    async (accountInfo, context) => {
      // Parse pool state to extract base mint (the new token)
      try {
        const data = accountInfo.accountInfo.data
        // Raydium AMM v4 layout: base mint at offset 400, quote mint at 432
        if (data.length < 440) return
        const baseMint  = new PublicKey(data.slice(400, 432)).toBase58()
        const quoteMint = new PublicKey(data.slice(432, 464)).toBase58()
        // Only care about SOL-paired pools (wrapped SOL = So11111...)
        const SOL_MINT = 'So11111111111111111111111111111111111111112'
        if (quoteMint === SOL_MINT || baseMint === SOL_MINT) {
          const newMint = baseMint === SOL_MINT ? quoteMint : baseMint
          onNewPool(newMint, accountInfo.accountId.toBase58(), context.slot)
        }
      } catch { /* malformed account */ }
    },
    'confirmed',
    [{ dataSize: 752 }] // Raydium pool state size filter
  )
  return subId
}

// ─── Safety checks ────────────────────────────────────────────────────────

export async function checkTokenSafety(mintAddress: string): Promise<SafetyChecks> {
  const mint = new PublicKey(mintAddress)

  // Fetch parsed mint account
  const mintInfo = await connection.getParsedAccountInfo(mint)
  if (!mintInfo.value) throw new Error(`Mint not found: ${mintAddress}`)

  const parsed = (mintInfo.value.data as any).parsed?.info
  if (!parsed) throw new Error('Could not parse mint account')

  const mintAuthNull   = parsed.mintAuthority === null
  const freezeAuthNull = parsed.freezeAuthority === null

  // Check LP lock — look for burn or known lock program
  const { lpLocked, lpLockDays, lpLockPlatform } = await checkLpLock(mintAddress)

  // Supply concentration — top 10 holders
  const top10Pct = await getTop10Concentration(mintAddress)

  // Bundle detection — multiple wallets buying in same launch block
  const isBundled = await detectBundledLaunch(mintAddress)

  // Liquidity depth
  const initialLiqUsd = await getPoolLiquidity(mintAddress)

  return {
    mintAuthNull,
    freezeAuthNull,
    lpLocked,
    lpLockDays,
    lpLockPlatform,
    top10Pct,
    isBundled,
    initialLiqUsd,
  }
}

async function checkLpLock(mintAddress: string): Promise<{
  lpLocked: boolean
  lpLockDays: number | null
  lpLockPlatform: string | null
}> {
  // Known lock program addresses
  const LOCK_PROGRAMS = {
    'TeamFinance': 'FLoCkrG9sqCEZMtriLDLHHiGgBGkEpNTNkbR1Pj6kFqM',
    'PinkSale':    'PnkSaLe11111111111111111111111111111111111111',
    'Raydium':     'BurnBurnBurnBurnBurnBurnBurnBurnBurnBurnBurn',
  }
  const BURN_ADDRESS = '1nc1nerator11111111111111111111111111111111'

  try {
    // Use Helius enhanced transactions to find LP token destination
    const resp = await fetch(`https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${process.env.HELIUS_API_KEY}&type=LIQUIDITY`)
    const txs = await resp.json()

    for (const tx of txs || []) {
      // Check if LP tokens sent to burn address
      for (const transfer of tx.tokenTransfers || []) {
        if (transfer.toUserAccount === BURN_ADDRESS) {
          return { lpLocked: true, lpLockDays: 36500, lpLockPlatform: 'BURN' }
        }
        for (const [platform, addr] of Object.entries(LOCK_PROGRAMS)) {
          if (transfer.toUserAccount === addr) {
            return { lpLocked: true, lpLockDays: 180, lpLockPlatform: platform }
          }
        }
      }
    }
  } catch { /* fallback */ }

  return { lpLocked: false, lpLockDays: null, lpLockPlatform: null }
}

async function getTop10Concentration(mintAddress: string): Promise<number> {
  try {
    const resp = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getTokenLargestAccounts',
          params: [mintAddress]
        })
      }
    )
    const { result } = await resp.json()
    if (!result?.value) return 100

    const accounts = result.value as Array<{ amount: string; uiAmount: number }>
    const total = accounts.reduce((s: number, a: any) => s + (a.uiAmount || 0), 0)
    const top10 = accounts.slice(0, 10).reduce((s: number, a: any) => s + (a.uiAmount || 0), 0)

    return total > 0 ? Math.round((top10 / total) * 100) : 100
  } catch {
    return 100 // Assume worst case
  }
}

async function detectBundledLaunch(mintAddress: string): Promise<boolean> {
  try {
    // If >3 wallets bought in the first 2 blocks → likely bundled
    const resp = await fetch(
      `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions?api-key=${process.env.HELIUS_API_KEY}&limit=20`
    )
    const txs = await resp.json()
    if (!Array.isArray(txs) || txs.length === 0) return false

    const firstSlot = txs[0]?.slot
    const earlyBuyers = new Set<string>()
    for (const tx of txs) {
      if (Math.abs(tx.slot - firstSlot) > 2) break
      for (const acct of tx.accountData || []) {
        if (acct.nativeBalanceChange < 0) earlyBuyers.add(acct.account)
      }
    }
    return earlyBuyers.size > 3
  } catch {
    return false
  }
}

async function getPoolLiquidity(mintAddress: string): Promise<number> {
  try {
    const resp = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${mintAddress}`,
      { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY || '' } }
    )
    const { data } = await resp.json()
    return data?.liquidity ?? 0
  } catch {
    return 0
  }
}

// ─── Market data ──────────────────────────────────────────────────────────

export async function getMarketData(mintAddress: string): Promise<MarketData> {
  try {
    const resp = await fetch(
      `https://public-api.birdeye.so/defi/ohlcv?address=${mintAddress}&type=5m&limit=2`,
      { headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY || '' } }
    )
    const { data } = await resp.json()
    const latest = data?.items?.[0]
    const prev   = data?.items?.[1]

    return {
      priceUsd:      latest?.c ?? 0,
      mcapUsd:       (latest?.c ?? 0) * 1_000_000,
      liqUsd:        await getPoolLiquidity(mintAddress),
      volume5m:      latest?.v ?? 0,
      volume1h:      (latest?.v ?? 0) * 12,
      priceChange5m: prev?.c > 0 ? ((latest?.c - prev.c) / prev.c) * 100 : 0,
      priceChange1h: 0,
      txCount5m:     0,
      buyCount5m:    0,
      sellCount5m:   0,
      buyPressure:   0.5,
    }
  } catch {
    return {
      priceUsd: 0, mcapUsd: 0, liqUsd: 0,
      volume5m: 0, volume1h: 0,
      priceChange5m: 0, priceChange1h: 0,
      txCount5m: 0, buyCount5m: 0, sellCount5m: 0,
      buyPressure: 0.5
    }
  }
}

// ─── Archival / Backtest data ─────────────────────────────────────────────

export async function getHistoricalTransactions(
  address: string,
  before?: string,
  limit = 100
): Promise<ParsedTransactionWithMeta[]> {
  const signatures = await connection.getSignaturesForAddress(
    new PublicKey(address),
    { before, limit }
  )

  const txs = await connection.getParsedTransactions(
    signatures.map(s => s.signature),
    { maxSupportedTransactionVersion: 0 }
  )

  return txs.filter(Boolean) as ParsedTransactionWithMeta[]
}

// ─── Deployer profiling ───────────────────────────────────────────────────

export async function getDeployerAddress(mintAddress: string): Promise<string | null> {
  try {
    const resp = await fetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTransaction',
        params: [mintAddress, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      })
    })
    const { result } = await resp.json()
    return result?.transaction?.message?.accountKeys?.[0]?.pubkey ?? null
  } catch {
    return null
  }
}
