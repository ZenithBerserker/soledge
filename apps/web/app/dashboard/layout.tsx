import Link from 'next/link'
import { Activity, LayoutDashboard, Radio } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="hidden w-52 shrink-0 border-r border-zinc-800/80 bg-zinc-900/40 p-4 md:block">
        <div className="mb-8 font-semibold tracking-tight">
          <span className="text-emerald-400">●</span> SOLEDGE
          <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">beta</span>
        </div>
        <nav className="flex flex-col gap-1 text-sm text-zinc-400">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-zinc-800/80 px-3 py-2 text-zinc-100"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 text-emerald-400" />
            Live feed
          </Link>
          <span className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 opacity-50">
            <Radio className="h-4 w-4" />
            Smart money
            <span className="ml-auto text-[10px]">soon</span>
          </span>
          <span className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 opacity-50">
            <Activity className="h-4 w-4" />
            Jito metrics
            <span className="ml-auto text-[10px]">soon</span>
          </span>
          <Link href="/" className="mt-6 rounded-lg px-3 py-2 text-zinc-500 hover:text-emerald-400">
            ← Simple feed
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              RPC
            </span>
            <span className="hidden sm:inline">Meteora DLMM · ingest + quotes</span>
          </div>
          <div className="text-xs text-zinc-600">Worker runs off-Vercel</div>
        </header>

        <div className="flex flex-1 min-h-0">
          <div className="min-w-0 flex-1 overflow-auto">{children}</div>
          <aside className="hidden w-64 shrink-0 border-l border-zinc-800/80 bg-zinc-900/20 p-4 text-xs text-zinc-500 xl:block">
            <p className="mb-2 font-medium text-zinc-400">Execution</p>
            <p>
              Snipe / bundle buttons are <strong className="text-zinc-300">not wired</strong> here. Set{' '}
              <code className="rounded bg-zinc-800 px-1">EXECUTION_MODE=simulate</code> on the worker to log dry-run
              plans; live signing is a separate milestone.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
