function Pill({ status }: { status: 'live' | 'partial' | 'planned' }) {
  const cls =
    status === 'live'
      ? 'border-[rgba(0,255,136,0.35)] bg-[var(--sn-green-bg)] text-[var(--sn-green)]'
      : status === 'partial'
        ? 'border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] text-[var(--sn-amber)]'
        : 'border-[var(--sn-border)] bg-[var(--sn-bg3)] text-[var(--sn-text3)]'
  const label = status === 'live' ? 'LIVE' : status === 'partial' ? 'PARTIAL' : 'PLANNED'
  return (
    <span className={`rounded px-2 py-0.5 sniper-mono text-[9px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

export function DiscoveryStrategies() {
  const cards = [
    {
      title: 'Two-pool DLMM hunter',
      status: 'live' as const,
      body:
        'Discovery worker + dashboard scan reuse Meteora DLMM quotes across pairs you configure (JSON file / mirror main POOL_PAIRS_*). Tags rows scanner · discovery.',
    },
    {
      title: 'Mispricing detector',
      status: 'live' as const,
      body:
        'Uses DISCOVERY_MIN_PROFIT_MULTIPLE (looser than MIN_PROFIT_MULTIPLE) plus DISCOVERY_ASSUMED_POOL_LIQ_USD to bias toward thin-pool chaos signals.',
    },
    {
      title: 'Instant route simulation',
      status: 'partial' as const,
      body:
        'Two-hop quotes return immediately per pair; use Simulate snipe / wallet preflight on rows. Multi-hop graphs + Jupiter-style routing are not wired yet.',
    },
    {
      title: 'Atomic Jito bundles',
      status: 'live' as const,
      body:
        'Worker path: EXECUTION_SUBMIT=jito merges arb + tip client-side (same core bundle helper). Dashboard wallet button uses RPC-only merged legacy tx.',
    },
    {
      title: 'Tiny capital clips',
      status: 'live' as const,
      body:
        'DISCOVERY_AMOUNT_RAW defaults small so quotes skim chaotic bins without sizing like size-aware arb engines.',
    },
    {
      title: 'Fresh pool radar',
      status: 'partial' as const,
      body:
        'There is no on-chain crawler yet — drop candidate LB pairs into DISCOVERY_POOL_PAIRS_JSON or mirror POOL_PAIRS until we add snapshot/index hooks.',
    },
  ]

  return (
    <section className="mb-6 rounded-lg border border-[var(--sn-border)] bg-[var(--sn-bg2)] p-4">
      <h2 className="text-[13px] font-semibold tracking-tight text-[var(--sn-text)]">DLMM discovery stack</h2>
      <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-[var(--sn-text3)]">
        Operational pieces run today on two DLMM hops + worker/dashboard ingestion. Items marked Planned require routing graphs or chain indexing beyond this repo slice.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.title} className="rounded-md border border-[var(--sn-border)] bg-[var(--sn-bg)] p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[12px] font-semibold text-[var(--sn-text)]">{c.title}</h3>
              <Pill status={c.status} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-[var(--sn-text3)]">{c.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
