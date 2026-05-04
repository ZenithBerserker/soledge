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
        className="rounded-lg border border-emerald-600/50 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-50"
      >
        {loading ? 'Simulating…' : 'Simulate snipe'}
      </button>
      {msg && (
        <p className="mt-2 max-w-[220px] text-[11px] leading-snug text-zinc-400">{msg}</p>
      )}
    </div>
  )
}
