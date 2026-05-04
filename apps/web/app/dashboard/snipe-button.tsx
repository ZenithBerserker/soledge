'use client'

import { useState } from 'react'
import { simulateSnipe } from './actions'

export function SnipeButton({ logId }: { logId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="mt-2 text-left">
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          void (async () => {
            setMsg(null)
            setLoading(true)
            try {
              const r = await simulateSnipe(logId)
              if (r.ok) {
                const x = r.projectedReturnX != null ? ` · ${r.projectedReturnX}x` : ''
                const ar = r.abortReason ? ` — ${r.abortReason}` : ''
                setMsg(`${r.message}${x}${ar}`)
              } else {
                setMsg(r.error)
              }
            } finally {
              setLoading(false)
            }
          })()
        }}
        className="sniper-btn-buy"
      >
        {loading ? 'Simulating…' : 'Simulate snipe'}
      </button>
      {msg && (
        <p className="sniper-mono mt-2 max-w-[260px] text-[11px] leading-snug text-[var(--sn-text2)]">{msg}</p>
      )}
    </div>
  )
}
