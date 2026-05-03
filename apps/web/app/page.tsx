import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let rows: { id: string; payload: unknown }[] = []
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
        The worker POSTs hits to <code className="mono">/api/opportunities</code>. In Vercel set{' '}
        <code className="mono">DATABASE_URL</code> and <code className="mono">ENGINE_INGEST_SECRET</code>. Check{' '}
        <a href="/api/health">/api/health</a> for a quick DB ping.
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
            <code className="mono">START_MINT</code>, or POST a test payload (same secret as Vercel):
          </p>
          <pre
            className="mono"
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 8,
              overflow: 'auto',
              fontSize: '0.75rem',
            }}
          >
            {`curl -sS -X POST "https://YOUR_PROJECT.vercel.app/api/opportunities" \\
  -H "Content-Type: application/json" \\
  -H "x-engine-secret: YOUR_ENGINE_INGEST_SECRET" \\
  -d '{"id":"test-1","detectedAt":"${new Date().toISOString()}","pairs":["TEST/USDC"],"entryAmountLabel":"1 USDC","projectedReturnX":1.01,"routeSteps":[],"recommendedJitoTipSol":0.5,"confidence":0.1,"priority":"low"}'`}
          </pre>
        </div>
      )}

      {rows.map((row) => {
        const o = row.payload as Record<string, unknown>
        return (
          <article key={row.id} className="card">
            <h2>
              {((o.pairs as string[]) || []).join(' · ') || 'Opportunity'}{' '}
              <span className="badge">{String(o.priority ?? '')}</span>
            </h2>
            <div className="row">
              <div>
                <div className="k">Return (x)</div>
                <div>{String(o.projectedReturnX)}</div>
              </div>
              <div>
                <div className="k">Jito tip (SOL)</div>
                <div>{String(o.recommendedJitoTipSol)}</div>
              </div>
              <div>
                <div className="k">Confidence</div>
                <div>{String(o.confidence)}</div>
              </div>
              <div>
                <div className="k">Entry</div>
                <div className="mono">{String(o.entryAmountLabel)}</div>
              </div>
              <div>
                <div className="k">Detected</div>
                <div className="mono">{String(o.detectedAt)}</div>
              </div>
            </div>
            {Array.isArray(o.routeSteps) && o.routeSteps.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div className="k">Route</div>
                <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                  {(o.routeSteps as Record<string, unknown>[]).map((s, i) => (
                    <li key={i} className="mono">
                      {String(s.kind)} pool {String(s.pool)?.slice(0, 8)}…
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
