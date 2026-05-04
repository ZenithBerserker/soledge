import { fetchTipFloor } from '@solana-mev-bot/core'

function solFromLamports(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return (n / 1e9).toFixed(4)
}

export async function JitoTipPanel() {
  let err: string | null = null
  let tip: Awaited<ReturnType<typeof fetchTipFloor>> | null = null
  try {
    tip = await fetchTipFloor()
  } catch (e) {
    err = e instanceof Error ? e.message : 'unavailable'
  }

  if (err) {
    return (
      <div className="sniper-rp-section">
        <div className="sniper-rp-title">
          JITO TIP ENGINE <span className="sniper-mono text-[10px] font-normal normal-case text-[var(--sn-red)]">ERR</span>
        </div>
        <div className="sniper-rp-body sniper-mono text-[11px] text-[var(--sn-red)]">Could not load: {err}</div>
      </div>
    )
  }

  if (!tip) return null

  const rows: [string, number, number][] = [
    ['p25', tip.p25, 22],
    ['p50', tip.p50, 40],
    ['p75', tip.p75, 58],
    ['p95', tip.p95, 78],
    ['p99', tip.p99, 92],
  ]

  return (
    <div className="sniper-rp-section">
      <div className="sniper-rp-title">
        JITO TIP ENGINE{' '}
        <span className="sniper-mono text-[10px] font-normal normal-case text-[var(--sn-text2)]">AUTO</span>
      </div>
      <div className="sniper-rp-body">
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--sn-text3)]">
          Landed tips from bundles.jito.wtf — sanity-check worker tip sizing (execution path here does not submit Jito
          bundles yet).
        </p>
        {rows.map(([k, v, w]) => (
          <div key={k}>
            <div className="sniper-tip-row">
              <span className="text-[var(--sn-text3)]">{k}</span>
              <span className="text-[var(--sn-text)]">{solFromLamports(v)} SOL</span>
            </div>
            <div className="sniper-tip-bar-wrap">
              <div className="sniper-tip-bar" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
