import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    const total = await prisma.opportunityLog.count()
    return NextResponse.json({
      ok: true,
      db: true,
      opportunities: { total },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { ok: false, db: false, opportunities: { total: 0 }, error: message },
      { status: 503 }
    )
  }
}
