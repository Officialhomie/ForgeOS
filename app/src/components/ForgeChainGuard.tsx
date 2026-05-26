'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { isDemoMode } from '@/lib/demo'
import { forgeChain } from '@/lib/wagmi/chains'
import { hasEthereumProvider } from '@/lib/wagmi/ethereum-provider'

/**
 * Warns in the console when connected on the wrong chain without a provider.
 * Does not call switchChain on mount — that caused ProviderNotFoundError when
 * wagmi had a stale "connected" state but MetaMask was unavailable.
 */
export function ForgeChainGuard() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const warned = useRef(false)

  useEffect(() => {
    if (isDemoMode() || !isConnected || chainId === forgeChain.id) {
      warned.current = false
      return
    }
    if (!hasEthereumProvider()) return
    if (warned.current) return
    warned.current = true
    console.info(
      `[ForgeOS] Wrong network (chain ${chainId}). Use Connect or activation to switch to ${forgeChain.name}.`,
    )
  }, [isConnected, chainId])

  return null
}
