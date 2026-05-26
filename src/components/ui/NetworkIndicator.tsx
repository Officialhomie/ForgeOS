'use client'

import { useAccount, useChainId } from 'wagmi'
import { sepolia, base } from '@/lib/wagmi/chains'
import { isDemoMode } from '@/lib/demo'

const CHAIN_LABELS: Record<number, string> = {
  [sepolia.id]: 'Sepolia',
  [base.id]: 'Base',
}

export function NetworkIndicator() {
  const chainId = useChainId()
  const { isConnected } = useAccount()

  if (isDemoMode()) {
    return (
      <span className="rounded-full border border-forge-border bg-forge-elevated px-3 py-1 text-xs text-forge-text-muted">
        Demo · Sepolia
      </span>
    )
  }

  const label = CHAIN_LABELS[chainId] ?? `Chain ${chainId}`

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        isConnected
          ? 'border-forge-success/40 bg-forge-success/10 text-forge-success'
          : 'border-forge-border bg-forge-elevated text-forge-text-muted'
      }`}
    >
      {isConnected ? label : 'Not connected'}
    </span>
  )
}
