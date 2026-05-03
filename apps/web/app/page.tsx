import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let rows: { id: string; payload: unknown }[] = []
  try {
    rows = await prisma.opportunityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  } catch {
    rows = []
  }

  return (
    <main>
      <h1>Meteora DLMM scanner feed</h1>
      <p className="sub">
        Dashboard on Vercel — the worker runs elsewhere (Fly.io, Railway, or a low-latency host) and POSTs hits to{' '}
        <code className="mono">/api/opportunities</code>. Set <code className="mono">DATABASE_URL</code> (Neon / Supabase)
        and <code className="mono">ENGINE_INGEST_SECRET</code> in Vercel.
      </p>

      {rows.length === 0 && <p className="empty">No opportunities logged yet (or database not connected).</p>}

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
