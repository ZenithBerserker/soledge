// apps/bot/src/discord.ts
// Discord bot — premium alpha channels, public rug detector, community feed

import {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, TextChannel, Events
} from 'discord.js'
import { TokenSignal, AlertType } from '@soledge/types'
import WebSocket from 'ws'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
})

// Channel IDs — set these in your Discord server
const CHANNELS = {
  FREE_SCAM_ALERTS:  process.env.DISCORD_CH_SCAM     ?? '',
  PRO_ALPHA:         process.env.DISCORD_CH_ALPHA     ?? '',
  ELITE_RAW:         process.env.DISCORD_CH_ELITE     ?? '',
  SMART_MONEY:       process.env.DISCORD_CH_SMART     ?? '',
  ANNOUNCEMENTS:     process.env.DISCORD_CH_ANNOUNCE  ?? '',
}

// Role IDs for tier gating
const ROLES = {
  PRO:   process.env.DISCORD_ROLE_PRO   ?? '',
  ELITE: process.env.DISCORD_ROLE_ELITE ?? '',
}

// ─── Bot startup ──────────────────────────────────────────────────────────

export async function startDiscordBot() {
  client.once(Events.ClientReady, () => {
    console.log(`[Discord] Logged in as ${client.user?.tag}`)
    connectToEngine()
  })

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return
    if (interaction.customId.startsWith('dex_')) {
      const mint = interaction.customId.replace('dex_', '')
      await interaction.reply({
        content: `[Dexscreener](https://dexscreener.com/solana/${mint}) | [Birdeye](https://birdeye.so/token/${mint}?chain=solana) | [Solscan](https://solscan.io/token/${mint})`,
        ephemeral: true
      })
    }
  })

  await client.login(process.env.DISCORD_BOT_TOKEN)
}

// ─── Engine WebSocket connection ──────────────────────────────────────────

function connectToEngine() {
  const ws = new WebSocket(
    `ws://localhost:${process.env.WS_PORT ?? 3001}?token=${process.env.ENGINE_BOT_TOKEN}`
  )

  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'SUBSCRIBE',
      events: ['TOKEN_LAUNCH', 'RUG_ALERT', 'SMART_MONEY', 'SENTIMENT_SURGE'],
    }))
    console.log('[Discord] Connected to engine WS')
  })

  ws.on('message', async (raw) => {
    try {
      const event = JSON.parse(raw.toString())
      switch (event.type) {
        case 'TOKEN_LAUNCH':   await handleTokenLaunch(event.data);   break
        case 'RUG_ALERT':      await handleRugAlert(event.data);       break
        case 'SMART_MONEY':    await handleSmartMoney(event.data);     break
        case 'SENTIMENT_SURGE': await handleSentimentSurge(event.data); break
      }
    } catch (err) {
      console.error('[Discord] Message error:', err)
    }
  })

  ws.on('close', () => {
    console.log('[Discord] WS disconnected, reconnecting in 5s...')
    setTimeout(connectToEngine, 5000)
  })
}

// ─── Alert formatters ─────────────────────────────────────────────────────

async function handleTokenLaunch(signal: TokenSignal) {
  // Only alert on BUY signals
  if (signal.recommendation !== 'BUY') return

  const embed = new EmbedBuilder()
    .setTitle(`⚡ ALPHA SIGNAL: $${signal.symbol}`)
    .setColor(0x00ff88)
    .setDescription(`New token passed all filters with composite score **${signal.compositeScore}/100**`)
    .addFields(
      {
        name: '🛡️ Safety Checks',
        value: [
          `${signal.checks.mintAuthNull   ? '✅' : '❌'} Mint Authority Null`,
          `${signal.checks.freezeAuthNull ? '✅' : '❌'} Freeze Authority Null`,
          `${signal.checks.lpLocked       ? '✅' : '❌'} LP Locked (${signal.checks.lpLockPlatform ?? 'unknown'})`,
          `${signal.checks.top10Pct < 30  ? '✅' : '⚠️'} Top 10 Concentration: ${signal.checks.top10Pct.toFixed(1)}%`,
        ].join('\n'),
        inline: true
      },
      {
        name: '📊 Market',
        value: [
          `💧 Liquidity: $${formatUsd(signal.checks.initialLiqUsd)}`,
          `📈 MCap: $${formatUsd(signal.market.mcapUsd)}`,
          `🔥 Vol 5m: $${formatUsd(signal.market.volume5m)}`,
          `📉 Change 5m: ${signal.market.priceChange5m > 0 ? '+' : ''}${signal.market.priceChange5m.toFixed(1)}%`,
        ].join('\n'),
        inline: true
      },
      {
        name: '🧠 Intelligence',
        value: [
          `👛 Smart Wallets: ${signal.smartMoney.activeWallets} buying (${signal.smartMoney.totalBoughtSol.toFixed(2)} SOL)`,
          `${signal.smartMoney.isCoordinated ? '🔴 COORDINATED ENTRY' : '⚪ Normal entry'}`,
          `📣 Sentiment: ${formatSentiment(signal.sentiment.score)} (${signal.sentiment.velocity} mentions/hr)`,
          `🏗️ Deployer Score: ${signal.deployer.reputationScore}/100`,
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: `${signal.mintAddress.slice(0,8)}...${signal.mintAddress.slice(-8)} • SolEdge Alpha` })
    .setTimestamp()

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setLabel('Dexscreener + Links')
        .setCustomId(`dex_${signal.mintAddress}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Trade Now')
        .setURL(`https://jup.ag/swap/SOL-${signal.mintAddress}`)
        .setStyle(ButtonStyle.Link),
    )

  const ch = await getChannel(CHANNELS.PRO_ALPHA)
  if (ch) await ch.send({ embeds: [embed], components: [row] })
}

async function handleRugAlert(data: any) {
  const embed = new EmbedBuilder()
    .setTitle(`☠️ RUG DETECTED: $${data.symbol ?? data.mintAddress.slice(0,8)}`)
    .setColor(0xff4560)
    .setDescription(`**${data.type.replace(/_/g, ' ')}** detected. Estimated loss: $${formatUsd(data.lossEstimateUsd ?? 0)}`)
    .addFields({ name: 'Contract', value: `\`${data.mintAddress}\`` })
    .setTimestamp()

  // Post to FREE channel — this is your funnel
  const ch = await getChannel(CHANNELS.FREE_SCAM_ALERTS)
  if (ch) await ch.send({ embeds: [embed] })
}

async function handleSmartMoney(data: any) {
  if (data.action !== 'BUY') return

  const embed = new EmbedBuilder()
    .setTitle(`🐋 SMART MONEY: ${data.walletLabel}`)
    .setColor(0x3b82f6)
    .setDescription(`**${data.action}** $${data.symbol ?? data.mintAddress.slice(0,8)} — ${data.amountSol.toFixed(3)} SOL`)
    .addFields(
      { name: 'Wallet', value: `\`${data.walletAddress}\``, inline: true },
      { name: 'Score',  value: `${data.walletScore}/100`,   inline: true },
      { name: 'Slot',   value: `${data.slot}`,              inline: true },
    )
    .setTimestamp()

  const ch = await getChannel(CHANNELS.SMART_MONEY)
  if (ch) await ch.send({ embeds: [embed] })
}

async function handleSentimentSurge(data: any) {
  const embed = new EmbedBuilder()
    .setTitle(`📣 SENTIMENT SURGE: $${data.symbol}`)
    .setColor(0xf59e0b)
    .setDescription(`**${data.velocity} mentions/hr** across social platforms`)
    .setTimestamp()

  const ch = await getChannel(CHANNELS.PRO_ALPHA)
  if (ch) await ch.send({ embeds: [embed] })
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getChannel(id: string): Promise<TextChannel | null> {
  if (!id) return null
  try {
    const ch = await client.channels.fetch(id)
    return ch?.type === ChannelType.GuildText ? ch as TextChannel : null
  } catch {
    return null
  }
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function formatSentiment(score: number): string {
  if (score > 0.5)  return '🟢 Very Bullish'
  if (score > 0.1)  return '🔵 Bullish'
  if (score > -0.1) return '⚪ Neutral'
  if (score > -0.5) return '🟡 Bearish'
  return '🔴 Very Bearish'
}
