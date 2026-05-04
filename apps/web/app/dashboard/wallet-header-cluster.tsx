'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export function WalletHeaderCluster() {
  return (
    <div className="flex shrink-0 items-center [&_.wallet-adapter-button]:sniper-mono [&_.wallet-adapter-button]:min-h-[30px] [&_.wallet-adapter-button]:rounded-md [&_.wallet-adapter-button]:border [&_.wallet-adapter-button]:border-[var(--sn-border)] [&_.wallet-adapter-button]:bg-[var(--sn-bg3)] [&_.wallet-adapter-button]:px-3 [&_.wallet-adapter-button]:py-1 [&_.wallet-adapter-button]:text-[11px] [&_.wallet-adapter-button]:text-[var(--sn-green)]">
      <WalletMultiButton />
    </div>
  )
}
