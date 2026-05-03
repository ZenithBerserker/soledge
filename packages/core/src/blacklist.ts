import { PublicKey } from '@solana/web3.js'

const DEFAULT_BLOCKLIST = new Set<string>([
  // Add mints you never touch (known rugs, honey pots, team wallets-as-mints, etc.)
])

export function loadBlacklistFromEnv(): Set<string> {
  const extra = process.env.TOKEN_BLOCKLIST_MINTS
  const merged = new Set(DEFAULT_BLOCKLIST)
  if (extra) {
    for (const m of extra.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)) {
      merged.add(m)
    }
  }
  return merged
}

export function assertMintAllowed(mint: PublicKey, blocklist: Set<string>): void {
  const s = mint.toBase58()
  if (blocklist.has(s)) throw new Error(`Blacklisted mint ${s}`)
}
