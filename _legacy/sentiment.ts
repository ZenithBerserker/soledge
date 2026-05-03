// apps/engine/src/services/sentiment.ts
// Multi-modal sentiment: LunarCrush API + Telegram scraping + keyword NLP

import { SentimentSignal, SentimentEvent } from '@soledge/types'
import { prisma } from './db'
import { broadcast } from '../websocket'

// Simple keyword-based sentiment scorer (production: replace with Claude API)
const BULLISH_KEYWORDS = [
  'gem','ape','moon','100x','bullish','buy','launch','send','alpha',
  'loaded','accumulate','early','dev doxxed','locked','audited','legit'
]
const BEARISH_KEYWORDS = [
  'rug','scam','dump','sell','honeypot','avoid','warning','exit','dead',
  'fraud','fake','bundled','coordinated','selloff','crash','ngmi'
]

export function scoreSentiment(text: string): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const kw of BULLISH_KEYWORDS) if (lower.includes(kw)) score += 0.1
  for (const kw of BEARISH_KEYWORDS) if (lower.includes(kw)) score -= 0.15
  return Math.max(-1, Math.min(1, score))
}

// ─── LunarCrush integration ───────────────────────────────────────────────

export async function getLunarCrushSentiment(symbol: string): Promise<{
  score: number
  velocity: number
  trending: boolean
} | null> {
  if (!process.env.LUNARCRUSH_API_KEY) return null

  try {
    const resp = await fetch(
      `https://lunarcrush.com/api4/public/coins/${symbol.toLowerCase()}/v1`,
      { headers: { Authorization: `Bearer ${process.env.LUNARCRUSH_API_KEY}` } }
    )
    const { data } = await resp.json()

    return {
      score:     (data?.sentiment ?? 50) / 100 * 2 - 1, // normalize 0-100 → -1 to +1
      velocity:  data?.social_volume_24h ?? 0,
      trending:  (data?.galaxy_score ?? 0) > 60,
    }
  } catch {
    return null
  }
}

// ─── Telegram monitoring ─────────────────────────────────────────────────

// Note: In production use Telegram MTProto via gramjs
// This shows the pattern — subscribe to public groups and parse mentions

export class TelegramMonitor {
  private groups = [
    '@solanagem', '@alphasolana', '@degen_calls',
    '@raydium_new', '@pump_fun_alerts',
  ]

  private mentionCounts = new Map<string, number>()
  private sentimentSums = new Map<string, number>()

  // Called by your gramjs/MTProto listener
  processMessage(text: string, groupId: string) {
    // Extract cashtags like $BONK, $MOCHI
    const cashtags = text.match(/\$[A-Z]{2,10}/g) ?? []
    const contractAddresses = text.match(/[1-9A-HJ-NP-Za-km-z]{43,44}/g) ?? []

    const score = scoreSentiment(text)

    for (const tag of cashtags) {
      const sym = tag.slice(1)
      this.mentionCounts.set(sym, (this.mentionCounts.get(sym) ?? 0) + 1)
      this.sentimentSums.set(sym, (this.sentimentSums.get(sym) ?? 0) + score)
    }
  }

  getSignal(symbol: string): { velocity: number; avgScore: number } {
    const mentions  = this.mentionCounts.get(symbol) ?? 0
    const sentSum   = this.sentimentSums.get(symbol) ?? 0
    return {
      velocity: mentions,
      avgScore: mentions > 0 ? sentSum / mentions : 0,
    }
  }

  // Reset hourly
  reset() {
    this.mentionCounts.clear()
    this.sentimentSums.clear()
  }
}

export const telegramMonitor = new TelegramMonitor()

// ─── Composite sentiment signal ───────────────────────────────────────────

export async function buildSentimentSignal(
  mintAddress: string,
  symbol: string
): Promise<SentimentSignal> {
  const [lunar, tgSignal] = await Promise.all([
    getLunarCrushSentiment(symbol),
    Promise.resolve(telegramMonitor.getSignal(symbol)),
  ])

  const twitterScore  = lunar?.score    ?? 0
  const telegramScore = tgSignal.avgScore
  const discordScore  = 0 // plug in your Discord bot listener

  const compositeScore = (
    twitterScore  * 0.4 +
    telegramScore * 0.4 +
    discordScore  * 0.2
  )

  const velocity = (lunar?.velocity ?? 0) + tgSignal.velocity
  const trending = (lunar?.trending ?? false) || velocity > 100

  const signal: SentimentSignal = {
    score: compositeScore,
    velocity,
    platforms: {
      twitter:  twitterScore,
      telegram: telegramScore,
      discord:  discordScore,
    },
    trending,
  }

  // Persist
  await prisma.sentimentLog.create({
    data: {
      symbol,
      platform: 'COMPOSITE',
      sentiment: compositeScore,
      velocity,
    }
  }).catch(() => {})

  // Broadcast surge alert
  if (trending && velocity > 200) {
    broadcast({
      type: 'SENTIMENT_SURGE',
      data: { symbol, mintAddress, platform: 'COMPOSITE', velocity, score: compositeScore } satisfies SentimentEvent
    })

    await prisma.alphaAlert.create({
      data: {
        type:  'SENTIMENT_SURGE',
        tier:  'PRO',
        title: `SENTIMENT SURGE: $${symbol}`,
        body:  `${velocity} mentions/hr detected across Twitter + Telegram. Score: ${(compositeScore * 100).toFixed(0)}/100`,
        metadata: { mintAddress, symbol, velocity }
      }
    }).catch(() => {})
  }

  return signal
}
