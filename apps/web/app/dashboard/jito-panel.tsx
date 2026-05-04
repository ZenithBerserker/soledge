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
      <div>
        <p className="mb-2 font-medium text-zinc-400">Jito tip floor</p>
        <p className="text-[11px] text-rose-400/90">Could not load: {err}</p>
      </div>
    )
  }

  if (!tip) return null

  const rows: [string, number][] = [
    ['p25', tip.p25],
    ['p50', tip.p50],
    ['p75', tip.p75],
    ['p95', tip.p95],
    ['p99', tip.p99],
  ]

  return (
    <div>
      <p className="mb-2 font-medium text-zinc-400">Jito tip floor (SOL)</p>
      <p className="mb-2 text-[10px] leading-relaxed text-zinc-600">
        Landed tips from bundles.jito.wtf — sanity-check before sizing worker tips.
      </p>
      <table className="w-full font-mono text-[11px] text-zinc-300">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-0.5 text-zinc-500">{k}</td>
              <td className="py-0.5 text-right">{solFromLamports(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
