import { prisma } from '@/lib/prisma'
import {
  confidenceDisplay,
  detectedDisplay,
  jitoTipDisplay,
  pairsTitle,
  payloadRecord,
  priorityBadge,
  routeStepLines,
} from '@/lib/opportunity-display'
import EmptyStateActions from './empty-state-actions'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let rows: { id: string; payload: unknown; createdAt: Date }[] = []
  let dbError: string | null = null

  try {
    rows = await prisma.opportunityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  } catch (e) {
    dbError = e instanceof Error ? e.message : 'Database query failed'
  }

  const missingEnv =
    dbError?.includes('DATABASE_URL') && dbError?.includes('Environment variable not found')
  const missingTable =
    dbError?.includes('does not exist') ||
    dbError?.includes('relation') ||
    dbError?.includes('OpportunityLog')

  return (
    <main>
      <h1>Meteora DLMM scanner feed</h1>
      <p className="sub">
        Monitors Meteora-style DLMM routes for large quoted edges (worker-side); small clips, slippage caps, and sim
        before live execution still apply. The worker POSTs JSON to <code className="mono">/api/opportunities</code>{' '}
        (<code className="mono">x-engine-secret</code> or <code className="mono">Authorization: Bearer …</code>). In
        Vercel set <code className="mono">DATABASE_URL</code> (Neon or Supabase Postgres) and{' '}
        <code className="mono">ENGINE_INGEST_SECRET</code>. Check <a href="/api/health">/api/health</a>.
      </p>

      {dbError && (
        <div className="alert alert-error" role="alert">
          <strong>{missingTable ? 'Tables not created yet' : 'Database error'}</strong>
          <span className="mono" style={{ fontSize: '0.8rem', opacity: 0.9 }}>
            {dbError}
          </span>
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem' }}>
            {missingEnv && (
              <li>
                In Vercel → Settings → Environment Variables, add <code className="mono">DATABASE_URL</code> (same
                string as Neon). Enable <strong>Production</strong>, then <strong>Redeploy</strong>.
              </li>
            )}
            {missingTable && (
              <li>
                Apply the migration once using the <strong>exact same</strong>{' '}
                <code className="mono">DATABASE_URL</code> as Vercel (copy from Neon):
                <pre
                  className="mono"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(0,0,0,0.25)',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    overflow: 'auto',
                  }}
                >
                  {`cd apps/web
export DATABASE_URL="paste-your-neon-connection-string-here"
npx prisma migrate deploy`}
                </pre>
                Alternative (no migration history):{' '}
                <code className="mono">npx prisma db push</code>
              </li>
            )}
            {!missingEnv && !missingTable && (
              <li>
                Check <a href="/api/health">/api/health</a> and verify <code className="mono">DATABASE_URL</code> in
                Vercel matches your Neon project.
              </li>
            )}
          </ul>
        </div>
      )}

      {!dbError && rows.length === 0 && (
        <div className="alert alert-ok">
          <strong>Database connected — no opportunities yet</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            Run the worker with real <code className="mono">POOL_A</code> / <code className="mono">POOL_B</code> /{' '}
            <code className="mono">START_MINT</code>, or POST a test payload (same secret as Vercel). Ignore advice
            about an <code className="mono">ArbOpportunity</code> table — that is a different codebase.
          </p>
          <EmptyStateActions />
        </div>
      )}

      {rows.map((row) => {
        const o = payloadRecord(row.payload)
        const steps = routeStepLines(o.routeSteps)
        return (
          <article key={row.id} className="card">
            <h2>
              {pairsTitle(o)}{' '}
              <span className="badge">{priorityBadge(o)}</span>
            </h2>
            <div className="row">
              <div>
                <div className="k">Return (x)</div>
                <div>{String(o.projectedReturnX ?? o.projected_return_x ?? '—')}</div>
              </div>
              <div>
                <div className="k">Jito tip (SOL)</div>
                <div>{jitoTipDisplay(o)}</div>
              </div>
              <div>
                <div className="k">Confidence</div>
                <div>{confidenceDisplay(o)}</div>
              </div>
              <div>
                <div className="k">Entry</div>
                <div className="mono">
                  {String(o.entryAmountLabel ?? o.entry_amount_label ?? o.entryAmountSol ?? '—')}
                </div>
              </div>
              <div>
                <div className="k">Detected</div>
                <div className="mono">{detectedDisplay(o, row.createdAt)}</div>
              </div>
            </div>
            {steps.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div className="k">Route</div>
                <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                  {steps.map((line, i) => (
                    <li key={i} className="mono">
                      {line}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {Array.isArray(o.notes) && (
              <ul style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
                {(o.notes as string[]).map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </article>
        )
      })}
    </main>
  )
}
