/**
 * Merges poolA, poolB, startMint into the most recent OpportunityLog.payload
 * so "Simulate snipe" works for rows that only had string routeSteps.
 *
 * Reads apps/web/.env.local then .env (first wins per key). Requires:
 *   DATABASE_URL, POOL_A, POOL_B, START_MINT
 *
 * Usage (from repo root):
 *   npm run db:enrich-pools -w @solana-mev-bot/web
 *   npm run db:enrich-pools -w @solana-mev-bot/web -- <poolA> <poolB> <startMint>
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvFile(absPath) {
  if (!existsSync(absPath)) return
  const text = readFileSync(absPath, 'utf8')
  for (let line of text.split('\n')) {
    const hash = line.indexOf('#')
    if (hash >= 0) line = line.slice(0, hash)
    line = line.trim()
    if (!line || !line.includes('=')) continue
    const eq = line.indexOf('=')
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && val !== '') process.env[key] = val
  }
}

const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '../..')
// Later files override earlier (apps/web .env.local wins)
loadEnvFile(resolve(repoRoot, '.env'))
loadEnvFile(resolve(webRoot, '.env'))
loadEnvFile(resolve(repoRoot, '.env.local'))
loadEnvFile(resolve(webRoot, '.env.local'))

const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const poolA = (argv[0] || process.env.POOL_A)?.trim()
const poolB = (argv[1] || process.env.POOL_B)?.trim()
const startMint = (argv[2] || process.env.START_MINT)?.trim()
const databaseUrl = process.env.DATABASE_URL?.trim()

if (!databaseUrl) {
  console.error('Missing DATABASE_URL (set in apps/web/.env.local)')
  process.exit(1)
}
if (!poolA || !poolB || !startMint) {
  console.error(
    'Missing pool pubkeys. Set POOL_A, POOL_B, START_MINT in .env (repo root or apps/web), or run:\n' +
      '  npm run db:enrich-pools -w @solana-mev-bot/web -- <poolA> <poolB> <startMint>'
  )
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const latest = await prisma.opportunityLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!latest) {
    console.error('No rows in OpportunityLog. POST to /api/opportunities or run the worker first.')
    process.exit(1)
  }

  const payload = latest.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    console.error('Latest row has invalid payload shape')
    process.exit(1)
  }

  const merged = { ...payload, poolA, poolB, startMint }

  await prisma.opportunityLog.update({
    where: { id: latest.id },
    data: { payload: merged },
  })

  console.log(`Updated OpportunityLog ${latest.id} with poolA, poolB, startMint.`)
} finally {
  await prisma.$disconnect()
}
