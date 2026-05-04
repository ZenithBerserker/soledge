import Link from 'next/link'
import { Zap } from 'lucide-react'
import {
  confidenceDisplay,
  detectedDisplay,
  jitoTipDisplay,
  pairsTitle,
  payloadRecord,
  priorityBadge,
  routeStepLines,
} from '@/lib/opportunity-display'
import { listRecentOpportunities } from '@/lib/opportunities'
import { SnipeButton } from './snipe-button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const rows = await listRecentOpportunities(40)

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">Live opportunities</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Jito floors load in the right rail. <strong className="text-zinc-400">Simulate snipe</strong> re-runs the
            two-pool Meteora quote for rows that include pool pubkeys in <code className="text-zinc-600">routeSteps</code>{' '}
            (curl-only tests often skip pools — use the worker for full shape).
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-400">
            {rows.length} rows
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-12 text-center text-sm text-zinc-500">
          No rows yet. POST to <code className="text-emerald-500/90">/api/opportunities</code> or run the worker.{' '}
          <Link href="/" className="text-emerald-400 underline">
            Open simple feed + curl helper
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const o = payloadRecord(row.payload)
            const steps = routeStepLines(o.routeSteps)
            return (
              <li
                key={row.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-sm transition hover:border-emerald-500/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-white">{pairsTitle(o)}</span>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                        {priorityBadge(o) || '—'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>
                        Tip: {jitoTipDisplay(o)}
                        {jitoTipDisplay(o) !== '—' ? ' SOL' : ''}
                      </span>
                      <span>Conf {confidenceDisplay(o)}</span>
                      <span className="font-mono text-zinc-600">{detectedDisplay(o, row.createdAt)}</span>
                    </div>
                    {steps.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {steps.map((line, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                              {line}
                            </span>
                            {i < steps.length - 1 && <Zap className="h-3 w-3 text-emerald-500/40" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-2xl font-bold tabular-nums text-emerald-400">
                      {String(o.projectedReturnX ?? '—')}
                      <span className="text-sm font-normal text-zinc-500">x</span>
                    </div>
                    <SnipeButton logId={row.id} />
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
