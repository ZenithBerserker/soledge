'use client'

import { useCallback, useEffect, useState } from 'react'

type Health = {
  ok?: boolean
  db?: boolean
  secretConfigured?: boolean
  opportunities?: { total?: number; tableReadable?: boolean }
  error?: string
}

function makeSampleBody() {
  return {
    id: 'test-1',
    detectedAt: new Date().toISOString(),
    pairs: ['TEST/USDC'],
    entryAmountLabel: '1 USDC',
    projectedReturnX: 1.01,
    routeSteps: [] as string[],
    recommendedJitoTipSol: 0.5,
    confidence: 0.1,
    priority: 'low',
  }
}

export function EmptyStateActions() {
  const [health, setHealth] = useState<Health | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false, error: 'Failed to fetch /api/health' }))
  }, [])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  const copyCurl = useCallback(() => {
    if (!origin) return
    const json = JSON.stringify(makeSampleBody())
    const text = `curl -sS -X POST "${origin}/api/opportunities" \\
  -H "Content-Type: application/json" \\
  -H "x-engine-secret: YOUR_ENGINE_INGEST_SECRET" \\
  -d '${json}'`
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopyState('ok')
        setTimeout(() => setCopyState('idle'), 2000)
      },
      () => {
        setCopyState('err')
        setTimeout(() => setCopyState('idle'), 2000)
      }
    )
  }, [origin])

  const curlPreview =
    origin &&
    `curl -sS -X POST "${origin}/api/opportunities" \\
  -H "Content-Type: application/json" \\
  -H "x-engine-secret: YOUR_ENGINE_INGEST_SECRET" \\
  -d '${JSON.stringify(makeSampleBody())}'`

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
        Rows live in <code className="mono">OpportunityLog</code> (JSON payload). This green panel means the query
        succeeded and returned <strong>0 rows</strong> — not a missing <code className="mono">ArbOpportunity</code>{' '}
        table (this repo never used that).
      </p>

      {health && (
        <div
          className="mono"
          style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 8,
            fontSize: '0.72rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(health, null, 2)}
        </div>
      )}

      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
        Put your real secret from Vercel in place of <code className="mono">YOUR_ENGINE_INGEST_SECRET</code>, then run
        the command (or use Copy):
      </p>
      <pre
        className="mono"
        style={{
          padding: '0.75rem',
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          overflow: 'auto',
          fontSize: '0.72rem',
          marginBottom: '0.5rem',
        }}
      >
        {curlPreview || 'Open this page in a browser to see the curl with your site URL filled in.'}
      </pre>
      <button type="button" className="btn" onClick={copyCurl} disabled={!origin}>
        {copyState === 'ok' ? 'Copied!' : copyState === 'err' ? 'Copy failed' : 'Copy curl (full command)'}
      </button>
    </div>
  )
}
