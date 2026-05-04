'use client'

import { useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function WalletArbButton({ logId }: { logId: string }) {
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [skipThreshold, setSkipThreshold] = useState(false)

  return (
    <div className="mt-2 text-left">
      <label className="flex cursor-pointer items-center gap-2 sniper-mono text-[10px] text-[var(--sn-text3)]">
        <input
          type="checkbox"
          checked={skipThreshold}
          onChange={(e) => setSkipThreshold(e.target.checked)}
          className="accent-[var(--sn-green)]"
        />
        Allow send below MIN_PROFIT_MULTIPLE (same tx shape as worker live RPC path)
      </label>
      <button
        type="button"
        disabled={loading || !publicKey}
        onClick={() => {
          void (async () => {
            setMsg(null)
            setLoading(true)
            try {
              if (!publicKey) {
                setMsg('Connect wallet first (header).')
                return
              }
              const r = await fetch('/api/arb/prepare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  logId,
                  feePayer: publicKey.toBase58(),
                  skipProfitCheck: skipThreshold,
                }),
              })
              const j = (await r.json()) as {
                error?: string
                txBase64?: string
              }
              if (!r.ok || j.error || !j.txBase64) {
                setMsg(j.error ?? `Prepare failed (${r.status})`)
                return
              }
              const tx = Transaction.from(base64ToUint8Array(j.txBase64))
              const sig = await sendTransaction(tx, connection, {
                skipPreflight: false,
                maxRetries: 5,
              })
              setMsg(`Sent · ${sig}`)
            } catch (e) {
              setMsg(e instanceof Error ? e.message : String(e))
            } finally {
              setLoading(false)
            }
          })()
        }}
        className="sniper-btn-buy mt-2 border border-[var(--sn-border)] bg-[var(--sn-bg)] text-[var(--sn-text)] hover:bg-[var(--sn-bg3)]"
      >
        {loading ? 'Signing…' : 'Sign & send round-trip (wallet)'}
      </button>
      {!publicKey && (
        <p className="sniper-mono mt-1 text-[10px] text-[var(--sn-amber)]">Connect Phantom in the header to enable.</p>
      )}
      {msg && (
        <p className="sniper-mono mt-2 max-w-[280px] break-all text-[11px] leading-snug text-[var(--sn-text2)]">{msg}</p>
      )}
    </div>
  )
}
