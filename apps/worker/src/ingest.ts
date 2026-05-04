const DASHBOARD_URL = () => process.env.DASHBOARD_URL
const INGEST_SECRET = () => process.env.ENGINE_INGEST_SECRET

export async function postOpportunity(body: object): Promise<void> {
  const urlBase = DASHBOARD_URL()?.trim()
  const secret = INGEST_SECRET()?.trim()
  if (!urlBase || !secret) {
    console.log('[worker] DASHBOARD_URL or ENGINE_INGEST_SECRET unset — logging only:')
    console.log(JSON.stringify(body, null, 2))
    return
  }
  const url = new URL('/api/opportunities', urlBase).toString()
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-engine-secret': secret,
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    console.error('[worker] ingest failed', r.status, await r.text())
  } else {
    console.log('[worker] ingested opportunity')
  }
}
