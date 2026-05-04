import Link from 'next/link'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { JitoTipPanel } from './jito-panel'
import './sniper-theme.css'

const fontSans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-ui',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fontSans.variable} ${fontMono.variable} sniper-root`}>
      <div className="sniper-terminal">
        <header className="sniper-topbar">
          <div className="sniper-logo">
            SOL<span>EDGE</span>
          </div>
          <div className="sniper-status-pill live sniper-mono">
            <span className="sniper-dot" />
            DLMM SCAN
          </div>
          <div className="sniper-status-pill live sniper-mono">
            <span className="sniper-dot" />
            QUOTES
          </div>
          <div className="sniper-status-pill warn sniper-mono">
            <span className="sniper-dot" />
            WORKER OFF-VERCEL
          </div>
          <div className="sniper-topbar-right sniper-mono">
            <div className="sniper-metric-chip">
              EXEC <span className="text-[var(--sn-amber)]">WORKER ONLY</span>
            </div>
            <div className="sniper-metric-chip">
              UI <span>NEXT</span>
            </div>
          </div>
        </header>

        <div className="sniper-main">
          <aside className="sniper-sidebar">
            <div className="sniper-panel-title">
              SMART MONEY WALLETS{' '}
              <span className="sniper-mono text-[9px] font-normal normal-case text-[var(--sn-green)]">● soon</span>
            </div>
            <div className="sniper-wallet-placeholder sniper-mono">
              Tracking / social graph is placeholder (legacy HTML had mock wallets). DLMM opportunities load in the center
              feed.
            </div>
            <Link href="/dashboard" className="sniper-link-dash sniper-mono">
              ● Live feed
            </Link>
            <Link href="/" className="sniper-link-dash sniper-mono">
              ← Simple feed / health
            </Link>
          </aside>

          <div className="sniper-center-wrap">
            <div className="sniper-filter-bar">
              <span className="sniper-filter-label">FILTERS</span>
              <span className="sniper-filter-btn on">DLMM</span>
              <span className="sniper-filter-btn on">INGEST</span>
              <span className="sniper-filter-btn">meme tier (soon)</span>
            </div>
            <div className="sniper-tab-bar">
              <span className="sniper-tab active">LIVE FEED</span>
              <span className="sniper-tab text-[var(--sn-text3)]">SMART MONEY · soon</span>
              <span className="sniper-tab text-[var(--sn-text3)]">RUG DET · soon</span>
            </div>
            <div className="sniper-feed-area">{children}</div>
          </div>

          <aside className="sniper-rpanel">
            <JitoTipPanel />
            <div className="sniper-rp-section">
              <div className="sniper-rp-title">LATENCY (MOCK)</div>
              <div className="sniper-rp-body sniper-mono text-[10px] text-[var(--sn-text3)]">
                Yellowstone-style stream lives on the worker (<span className="text-[var(--sn-cyan)]">WORKER_MODE=stream</span>{' '}
                / <span className="text-[var(--sn-cyan)]">both</span>), not on Vercel. This panel stays mock until you wire tip/latency APIs.
              </div>
            </div>
            <div className="sniper-rp-section">
              <div className="sniper-rp-title">EXECUTION</div>
              <div className="sniper-rp-body">
                <strong className="text-[var(--sn-text)]">LIVE swaps</strong> run on the{' '}
                <span className="sniper-mono text-[var(--sn-cyan)]">worker</span> when{' '}
                <span className="sniper-mono">EXECUTION_MODE=live</span>, confirmation string +{' '}
                <span className="sniper-mono">EXECUTOR_SECRET_KEY</span>. Use{' '}
                <span className="sniper-mono">EXECUTION_SUBMIT=jito</span> for Block Engine bundles (arb + tip tx).
                Keys never on Vercel; profit not guaranteed.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
