'use client'

import { useAccount, useChainId } from 'wagmi'
import { chainDisplayName, FORGE_CHAIN_ID } from '@/lib/chains/network'

export function NetworkIndicator() {
  const chainId = useChainId()
  const { isConnected } = useAccount()

  const onForge = chainId === FORGE_CHAIN_ID
  const label = onForge
    ? chainDisplayName(FORGE_CHAIN_ID)
    : `Wrong chain (${chainId})`

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs ${
        !isConnected
          ? 'border-forge-border bg-forge-elevated text-forge-text-muted'
          : onForge
            ? 'border-forge-success/40 bg-forge-success/10 text-forge-success'
            : 'border-forge-warning/40 bg-forge-warning/10 text-forge-warning'
      }`}
    >
      {isConnected ? label : 'Not connected'}
    </span>
  )
}
