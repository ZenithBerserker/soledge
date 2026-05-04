import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const secretConfigured = !!(
    process.env.ENGINE_INGEST_SECRET?.trim() || process.env.ENGINE_BOT_TOKEN?.trim()
  )

  try {
    await prisma.$queryRaw`SELECT 1`
    let total = 0
    let tableReadable = true
    try {
      total = await prisma.opportunityLog.count()
    } catch {
      tableReadable = false
    }
    return NextResponse.json({
      ok: true,
      db: true,
      secretConfigured,
      opportunities: { total, tableReadable },
      note: 'Schema uses OpportunityLog (JSON). Empty feed means total=0, not missing ArbOpportunity.',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      {
        ok: false,
        db: false,
        secretConfigured,
        opportunities: { total: 0, tableReadable: false },
        error: message,
      },
      { status: 503 }
    )
  }
}
