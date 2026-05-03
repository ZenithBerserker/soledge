// apps/engine/src/websocket.ts
// WebSocket server — broadcasts real-time events to dashboard + bot subscribers

import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { WsEvent } from '@soledge/types'
import { verifyToken } from './auth'

const PORT = Number(process.env.WS_PORT ?? 3001)

interface Client {
  ws: WebSocket
  userId: string
  tier: 'FREE' | 'PRO' | 'ELITE'
  subscriptions: Set<string>  // event types subscribed to
}

const clients = new Map<string, Client>()

let wss: WebSocketServer

export function startWebSocketServer() {
  const server = createServer()
  wss = new WebSocketServer({ server })

  wss.on('connection', async (ws, req) => {
    // Auth via token query param: ws://...?token=JWT
    const url   = new URL(req.url ?? '', `http://localhost`)
    const token = url.searchParams.get('token')

    let userId = 'anonymous'
    let tier: Client['tier'] = 'FREE'

    if (token) {
      try {
        const payload = await verifyToken(token)
        userId = payload.sub
        tier   = payload.tier ?? 'FREE'
      } catch {
        ws.close(4001, 'Invalid token')
        return
      }
    }

    const clientId = `${userId}-${Date.now()}`
    const client: Client = {
      ws,
      userId,
      tier,
      subscriptions: new Set(['TOKEN_LAUNCH', 'RUG_ALERT', 'SLOT_UPDATE']),
    }
    clients.set(clientId, client)

    ws.send(JSON.stringify({ type: 'CONNECTED', data: { clientId, tier } }))

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'SUBSCRIBE' && Array.isArray(msg.events)) {
          for (const ev of msg.events) {
            // Gate PRO/ELITE events
            if (['SMART_MONEY', 'VOLUME_ANOMALY'].includes(ev) && tier === 'FREE') continue
            if (['SENTIMENT_SURGE'].includes(ev) && tier === 'FREE') continue
            client.subscriptions.add(ev)
          }
        }
        if (msg.type === 'UNSUBSCRIBE' && Array.isArray(msg.events)) {
          for (const ev of msg.events) client.subscriptions.delete(ev)
        }
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }))
      } catch { /* ignore malformed */ }
    })

    ws.on('close', () => clients.delete(clientId))
    ws.on('error', () => clients.delete(clientId))
  })

  server.listen(PORT, () => console.log(`[WS] Listening on :${PORT}`))
}

// ─── Broadcast ────────────────────────────────────────────────────────────

export function broadcast(event: WsEvent) {
  const payload = JSON.stringify(event)

  for (const client of clients.values()) {
    if (client.ws.readyState !== WebSocket.OPEN) continue
    if (!client.subscriptions.has(event.type)) continue

    // Tier gating
    if (event.type === 'SMART_MONEY'    && client.tier === 'FREE') continue
    if (event.type === 'SENTIMENT_SURGE' && client.tier === 'FREE') continue

    client.ws.send(payload)
  }
}

export function broadcastToUser(userId: string, event: WsEvent) {
  const payload = JSON.stringify(event)
  for (const client of clients.values()) {
    if (client.userId !== userId) continue
    if (client.ws.readyState !== WebSocket.OPEN) continue
    client.ws.send(payload)
  }
}

export function getConnectedCount(): number {
  return clients.size
}
