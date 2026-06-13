'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from '@/types'
import { readUserTreasuryBalance, readWalletUsdcBalance } from '@/lib/treasury/onchain'

const POLL_MS = 15_000

export interface ActivationFundingStatus {
  poolBalance: bigint | null
  walletUsdc: bigint | null
  loading: boolean
  funded: boolean
  refresh: () => void
}

export function useActivationFundingStatus(): ActivationFundingStatus {
  const { address, isConnected } = useAccount()
  const [poolBalance, setPoolBalance] = useState<bigint | null>(null)
  const [walletUsdc, setWalletUsdc] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!isConnected || !address) {
      setPoolBalance(null)
      setWalletUsdc(null)
      setLoading(false)
      return
    }

    const user = address as Address
    setLoading(true)
    void Promise.all([readUserTreasuryBalance(user), readWalletUsdcBalance(user)])
      .then(([pool, wallet]) => {
        setPoolBalance(pool)
        setWalletUsdc(wallet)
      })
      .finally(() => setLoading(false))
  }, [address, isConnected])

  useEffect(() => {
    refresh()
    if (!isConnected || !address) return
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh, isConnected, address])

  const funded = typeof poolBalance === 'bigint' && poolBalance > 0n

  return { poolBalance, walletUsdc, loading, funded, refresh }
}
