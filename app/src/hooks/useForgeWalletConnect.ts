'use client'

import { useCallback } from 'react'
import { useConnect, useSwitchChain } from 'wagmi'
import { ensureForgeChain } from '@/lib/wagmi/ensure-forge-chain'
import {
  formatWalletError,
  hasEthereumProvider,
} from '@/lib/wagmi/ethereum-provider'

/** MetaMask connect + switch/add Ethereum Sepolia (shared by activation + TopBar). */
export function useForgeWalletConnect() {
  const { connect, connectors, isPending, error } = useConnect()
  const { switchChainAsync } = useSwitchChain()

  const connectWallet = useCallback(async () => {
    const mm = connectors.find((c) => c.id === 'metaMask') ?? connectors[0]
    if (!mm) {
      throw new Error(
        'No MetaMask connector found. Install the MetaMask extension and refresh.',
      )
    }
    if (!hasEthereumProvider()) {
      throw new Error(formatWalletError({ name: 'ProviderNotFoundError' }))
    }

    await new Promise<void>((resolve, reject) => {
      connect(
        { connector: mm },
        {
          onSuccess: () => {
            void ensureForgeChain(switchChainAsync)
              .then(() => resolve())
              .catch((e) => reject(new Error(formatWalletError(e))))
          },
          onError: (e) => reject(new Error(formatWalletError(e))),
        },
      )
    })
  }, [connect, connectors, switchChainAsync])

  return { connectWallet, isPending, error, connectors }
}
