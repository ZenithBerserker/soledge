import { NextResponse } from 'next/server'
import { PublicKey, Transaction } from '@solana/web3.js'
import { createRpcConnection, prepareWalletTwoPoolRoundTrip } from '@solana-mev-bot/core'
import { extractTwoPoolFromPayload, startAmountRawFromPayload } from '@/lib/extract-two-pool'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function txToBase64(tx: Transaction): string {
  const buf = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  })
  return Buffer.from(buf).toString('base64')
}

/**
 * POST { logId, feePayer, skipProfitCheck?: boolean }
 * Returns serialized unsigned legacy tx + confirmation hints for wallet signing.
 */
export async function POST(req: Request) {
  if (!process.env.HELIUS_API_KEY?.trim()) {
    return NextResponse.json({ error: 'HELIUS_API_KEY not set on server' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected object body' }, { status: 400 })
  }

  const o = body as Record<string, unknown>
  const logId = typeof o.logId === 'string' ? o.logId : ''
  const feePayerStr = typeof o.feePayer === 'string' ? o.feePayer : ''
  const skipProfitCheck = o.skipProfitCheck === true

  if (!logId || logId.length < 8) {
    return NextResponse.json({ error: 'logId required' }, { status: 400 })
  }
  let feePayer: PublicKey
  try {
    feePayer = new PublicKey(feePayerStr)
  } catch {
    return NextResponse.json({ error: 'Invalid feePayer pubkey' }, { status: 400 })
  }

  const row = await prisma.opportunityLog.findUnique({ where: { id: logId } })
  if (!row) {
    return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const p = row.payload as Record<string, unknown>
  const extracted = extractTwoPoolFromPayload(p)
  if ('error' in extracted) {
    return NextResponse.json({ error: extracted.error }, { status: 400 })
  }

  const params = {
    poolA: new PublicKey(extracted.poolA),
    poolB: new PublicKey(extracted.poolB),
    startMint: new PublicKey(extracted.startMint),
    startAmountIn: startAmountRawFromPayload(p),
  }

  try {
    const connection = createRpcConnection()
    const built = await prepareWalletTwoPoolRoundTrip(connection, params, feePayer, {
      skipProfitCheck,
    })

    return NextResponse.json({
      txBase64: txToBase64(built.transaction),
      blockhash: built.blockhash,
      lastValidBlockHeight: built.lastValidBlockHeight,
      binArrayCountUsed: built.binArrayCountUsed,
      skipProfitCheck,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
