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

export async function POST(req: Request) {
  const secret = process.env.ENGINE_INGEST_SECRET
  if (!secret || req.headers.get('x-engine-secret') !== secret) {
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
