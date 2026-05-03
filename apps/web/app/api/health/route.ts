import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json(
      { ok: false, db: false, error: message },
      { status: 503 }
    )
  }
}
