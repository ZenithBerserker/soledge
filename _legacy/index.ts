// packages/types/src/index.ts

export interface TokenSignal {
  mintAddress: string
  symbol: string
  name: string
  safetyScore: number         // 0-100
  compositeScore: number      // weighted final score
  checks: SafetyChecks
  market: MarketData
  smartMoney: SmartMoneySignal
  sentiment: SentimentSignal
  deployer: DeployerSignal
  recommendation: 'BUY' | 'WATCH' | 'SKIP' | 'RUG'
  jitoBundle?: JitoBundleParams
}

export interface SafetyChecks {
  mintAuthNull: boolean
  freezeAuthNull: boolean
  lpLocked: boolean
  lpLockDays: number | null
  lpLockPlatform: string | null
  top10Pct: number
  isBundled: boolean
  initialLiqUsd: number
}

export interface MarketData {
  priceUsd: number
  mcapUsd: number
  liqUsd: number
  volume5m: number
  volume1h: number
  priceChange5m: number
  priceChange1h: number
  txCount5m: number
  buyCount5m: number
  sellCount5m: number
  buyPressure: number         // 0-1
}

export interface SmartMoneySignal {
  activeWallets: number       // # of tracked wallets buying
  totalBoughtSol: number
  walletLabels: string[]
  avgWalletScore: number
  isCoordinated: boolean      // multiple wallets same slot
  coordinatedExitDetected: boolean
}

export interface SentimentSignal {
  score: number               // -1 to +1
  velocity: number            // mentions/hr
  platforms: {
    twitter: number
    telegram: number
    discord: number
  }
  trending: boolean
}

export interface DeployerSignal {
  address: string
  reputationScore: number
  previousLaunches: number
  previousRugs: number
  tags: string[]
  isKnownBad: boolean
}

export interface JitoBundleParams {
  tip: number                  // in lamports
  transactions: string[]       // base58 encoded
  bundleOnly: boolean
  dontfront: boolean
}

// ─── API Response shapes ─────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  rateLimit?: {
    remaining: number
    reset: number
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ─── WebSocket Events ─────────────────────────────────────────────────────────

export type WsEvent =
  | { type: 'TOKEN_LAUNCH';    data: TokenSignal }
  | { type: 'RUG_ALERT';       data: RugAlert }
  | { type: 'SMART_MONEY';     data: SmartMoneyEvent }
  | { type: 'SENTIMENT_SURGE'; data: SentimentEvent }
  | { type: 'JITO_METRICS';    data: JitoMetrics }
  | { type: 'SLOT_UPDATE';     data: { slot: number; tps: number } }

export interface RugAlert {
  mintAddress: string
  symbol: string
  type: 'MINT_DUMP' | 'LP_PULL' | 'FREEZE' | 'COORDINATED_SELL'
  lossEstimateUsd: number
  detectedAt: string
}

export interface SmartMoneyEvent {
  walletAddress: string
  walletLabel: string
  walletScore: number
  mintAddress: string
  symbol: string
  action: 'BUY' | 'SELL'
  amountSol: number
  slot: number
}

export interface SentimentEvent {
  symbol: string
  mintAddress?: string
  platform: string
  velocity: number
  score: number
}

export interface JitoMetrics {
  p25: number
  p50: number
  p75: number
  p95: number
  p99: number
  slot: number
}

// ─── Subscription tiers ───────────────────────────────────────────────────────

export const PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    features: {
      alertsPerDay: 5,
      smartWallets: 3,
      apiCalls: 0,
      rugAlerts: true,
      alphaSignals: false,
      rawApiAccess: false,
      discordAlerts: false,
      telegramAlerts: false,
      backtestAccess: false,
    }
  },
  PRO: {
    name: 'Pro',
    price: 49,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      alertsPerDay: 100,
      smartWallets: 12,
      apiCalls: 10000,
      rugAlerts: true,
      alphaSignals: true,
      rawApiAccess: false,
      discordAlerts: true,
      telegramAlerts: true,
      backtestAccess: true,
    }
  },
  ELITE: {
    name: 'Elite',
    price: 199,
    stripePriceId: process.env.STRIPE_ELITE_PRICE_ID,
    features: {
      alertsPerDay: -1,        // unlimited
      smartWallets: -1,
      apiCalls: -1,
      rugAlerts: true,
      alphaSignals: true,
      rawApiAccess: true,
      discordAlerts: true,
      telegramAlerts: true,
      backtestAccess: true,
    }
  }
} as const

export type PlanName = keyof typeof PLANS
