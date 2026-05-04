#!/usr/bin/env node
/**
 * Push secrets from apps/web/.env.vercel.secrets into Vercel (no dashboard typing).
 *
 * Prerequisites:
 *   1. Copy apps/web/.env.vercel.secrets.example → apps/web/.env.vercel.secrets (gitignored)
 *   2. Fill DATABASE_URL, HELIUS_API_KEY, ENGINE_INGEST_SECRET, NEXT_PUBLIC_SOLANA_RPC_URL, DISCOVERY_POOL_PAIRS_JSON
 *   3. Create token: Vercel → Account Settings → Tokens
 *   4. cd repo root:
 *        VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=prj_xxx npm run vercel:push-env
 *      Optional team scope:
 *        VERCEL_TEAM_ID=team_xxx
 *      Project ID auto-read from apps/web/.vercel/project.json after `cd apps/web && vercel link`
 *
 * Does not commit secrets. Non-secret defaults live in apps/web/vercel.json → env {}
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const defaultSecretsPath = path.join(repoRoot, 'apps/web/.env.vercel.secrets')

function parseDotEnv(content) {
  const out = []
  for (const line of content.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out.push({ key, value: val })
  }
  return out
}

function inferType(key) {
  return key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted'
}

function readProjectId() {
  const envId = process.env.VERCEL_PROJECT_ID?.trim()
  if (envId) return envId
  const projectJson = path.join(repoRoot, 'apps/web/.vercel/project.json')
  if (!fs.existsSync(projectJson)) return null
  try {
    const j = JSON.parse(fs.readFileSync(projectJson, 'utf8'))
    return typeof j.projectId === 'string' ? j.projectId : null
  } catch {
    return null
  }
}

async function listEnv(projectId, teamId, token) {
  const u = new URL(`https://api.vercel.com/v10/projects/${projectId}/env`)
  if (teamId) u.searchParams.set('teamId', teamId)
  const r = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`list env failed ${r.status}: ${t}`)
  }
  const j = await r.json()
  return Array.isArray(j.envs) ? j.envs : []
}

async function upsertEnv(projectId, teamId, token, key, value, type) {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
  const envs = await listEnv(projectId, teamId, token)
  const hit = envs.find((e) => e.key === key)

  const targets = ['production', 'preview', 'development']

  if (hit?.id) {
    const url = `https://api.vercel.com/v10/projects/${projectId}/env/${hit.id}${qs}`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value,
        type,
        target: hit.target ?? targets,
      }),
    })
    if (!r.ok) {
      const t = await r.text()
      throw new Error(`PATCH ${key} failed ${r.status}: ${t}`)
    }
    return 'updated'
  }

  const url = `https://api.vercel.com/v10/projects/${projectId}/env${qs}`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type,
      target: targets,
      comment: '',
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`POST ${key} failed ${r.status}: ${t}`)
  }
  return 'created'
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || ''
  const projectId = readProjectId()
  const secretsPath =
    process.argv[2]?.trim() ||
    process.env.VERCEL_SECRETS_FILE?.trim() ||
    defaultSecretsPath

  if (!token) {
    console.error('Missing VERCEL_TOKEN (create under Vercel → Settings → Tokens)')
    process.exit(1)
  }
  if (!projectId) {
    console.error(
      'Missing VERCEL_PROJECT_ID and apps/web/.vercel/project.json — run: cd apps/web && vercel link'
    )
    process.exit(1)
  }
  if (!fs.existsSync(secretsPath)) {
    console.error(`Secrets file not found: ${secretsPath}`)
    console.error('Copy apps/web/.env.vercel.secrets.example → apps/web/.env.vercel.secrets')
    process.exit(1)
  }

  const raw = fs.readFileSync(secretsPath, 'utf8')
  const pairs = parseDotEnv(raw).filter((p) => p.key && p.value !== '')
  if (pairs.length === 0) {
    console.error('No KEY=value lines with non-empty values in secrets file.')
    process.exit(1)
  }

  console.log(`Project ${projectId} · pushing ${pairs.length} vars from ${secretsPath}`)

  for (const { key, value } of pairs) {
    const type = inferType(key)
    const action = await upsertEnv(projectId, teamId, token, key, value, type)
    console.log(`  ${action}: ${key} (${type})`)
    await new Promise((r) => setTimeout(r, 120))
  }

  console.log('\nDone. Trigger a redeploy (git push empty commit or Vercel → Deployments → Redeploy).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
