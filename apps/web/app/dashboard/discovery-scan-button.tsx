'use client'

import { useState } from 'react'
import { dashboardDiscoveryScanAction } from './discovery-actions'

export function DiscoveryScanButton() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="rounded-lg border border-[var(--sn-border)] bg-[var(--sn-bg)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            void (async () => {
              setMsg(null)
              setLoading(true)
              try {
                const r = await dashboardDiscoveryScanAction()
                if (!r.ok) {
                  setMsg(r.error)
                  return
                }
                const errTail =
                  r.errors.length > 0 ? ` · warnings: ${r.errors.slice(0, 4).join(' · ')}` : ''
                setMsg(
                  `OK · pair configs scanned ${r.scanned} · rows ingested ${r.ingested}${errTail}`
                )
              } finally {
                setLoading(false)
              }
            })()
          }}
          className="sniper-btn-buy"
        >
          {loading ? 'Scanning…' : 'Run chaos discovery scan'}
        </button>
        <span className="sniper-mono text-[10px] text-[var(--sn-text3)]">
          Requires{' '}
          <span className="text-[var(--sn-cyan)]">DISCOVERY_SCAN_ENABLED=1</span> + pair JSON +{' '}
          <span className="text-[var(--sn-cyan)]">HELIUS_API_KEY</span> · capped pairs/time (
          <span className="text-[var(--sn-text2)]">DISCOVERY_MAX_PAIRS_PER_SCAN</span>) · each JSON entry =
          one two-pool route (poolA + poolB + startMint), not “every Meteora pool”
        </span>
      </div>
      {msg && (
        <p className="sniper-mono mt-3 whitespace-pre-wrap break-words text-[11px] leading-snug text-[var(--sn-text2)]">
          {msg}
        </p>
      )}
    </div>
  )
}
