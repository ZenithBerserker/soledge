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
  scannerKindDisplay,
  scannerLabelDisplay,
} from '@/lib/opportunity-display'
import { listRecentOpportunities } from '@/lib/opportunities'
import { SnipeButton } from './snipe-button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const rows = await listRecentOpportunities(40)

  return (
    <div className="p-4 md:p-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-[var(--sn-text)]">Live opportunities</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-[var(--sn-text3)]">
            Two-pool Meteora DLMM rows from the worker / ingest.{' '}
            <strong className="text-[var(--sn-text2)]">Simulate snipe</strong> re-quotes on the server;{' '}
            <strong className="text-[var(--sn-text2)]">LIVE swaps</strong> fire from the worker only (
            <span className="sniper-mono text-[11px] text-[var(--sn-cyan)]">EXECUTION_MODE=live</span>).
          </p>
        </div>
        <div className="sniper-mono flex gap-2 text-[11px] text-[var(--sn-text2)]">
          <span className="rounded-md border border-[var(--sn-border)] bg-[var(--sn-bg3)] px-3 py-1">{rows.length} rows</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--sn-border)] py-16 text-[12px] text-[var(--sn-text3)]">
          No rows yet. POST to{' '}
          <code className="sniper-mono text-[var(--sn-green)]">/api/opportunities</code> or run the worker.{' '}
          <Link href="/" className="text-[var(--sn-green)] underline">
            Health + curl helper
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const o = payloadRecord(row.payload)
            const steps = routeStepLines(o.routeSteps)
            const scanLabel = scannerLabelDisplay(o)
            const scanKind = scannerKindDisplay(o)
            return (
              <li key={row.id} className="sniper-token-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-[var(--sn-text)]">{pairsTitle(o)}</span>
                      <span className="rounded border border-[rgba(0,255,136,0.25)] bg-[var(--sn-green-bg)] px-2 py-0.5 sniper-mono text-[11px] font-medium text-[var(--sn-green)]">
                        {priorityBadge(o) || '—'}
                      </span>
                    </div>
                    {(scanLabel || scanKind) && (
                      <div className="mt-1 sniper-mono text-[10px] uppercase tracking-wide text-[var(--sn-text3)]">
                        scanner
                        {scanKind ? ` · ${scanKind}` : ''}
                        {scanLabel ? ` · ${scanLabel}` : ''}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 sniper-mono text-[11px] text-[var(--sn-text3)]">
                      <span>
                        Tip: {jitoTipDisplay(o)}
                        {jitoTipDisplay(o) !== '—' ? ' SOL' : ''}
                      </span>
                      <span>Conf {confidenceDisplay(o)}</span>
                      <span className="text-[var(--sn-text3)]">{detectedDisplay(o, row.createdAt)}</span>
                    </div>
                    {steps.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {steps.map((line, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            <span className="rounded border border-[var(--sn-border)] bg-[var(--sn-bg)] px-2 py-0.5 sniper-mono text-[11px] text-[var(--sn-text2)]">
                              {line}
                            </span>
                            {i < steps.length - 1 && <Zap className="h-3 w-3 text-[var(--sn-green)] opacity-40" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="sniper-mono text-2xl font-bold tabular-nums text-[var(--sn-green)]">
                      {String(o.projectedReturnX ?? '—')}
                      <span className="text-sm font-normal text-[var(--sn-text3)]">x</span>
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
