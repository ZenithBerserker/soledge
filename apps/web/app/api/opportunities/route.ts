import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await prisma.opportunityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, createdAt: r.createdAt, ...((r.payload as object) ?? {}) })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Database error'
    return NextResponse.json({ items: [], error: msg }, { status: 503 })
  }
}

function ingestAuthorized(req: Request): boolean {
  const ingest = process.env.ENGINE_INGEST_SECRET
  const bot = process.env.ENGINE_BOT_TOKEN
  if (req.headers.get('x-engine-secret') === ingest && ingest) return true
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (ingest && token === ingest) return true
    if (bot && token === bot) return true
  }
  return false
}

export async function POST(req: Request) {
  if (!process.env.ENGINE_INGEST_SECRET && !process.env.ENGINE_BOT_TOKEN) {
    return NextResponse.json(
      { error: 'Server misconfigured: set ENGINE_INGEST_SECRET or ENGINE_BOT_TOKEN' },
      { status: 500 }
    )
  }
  if (!ingestAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const payload = JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue

    await prisma.opportunityLog.create({
      data: { payload },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Write failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
