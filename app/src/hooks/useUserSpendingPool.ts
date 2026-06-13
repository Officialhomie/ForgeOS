'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from '@/types'
import { readUserTreasuryBalance } from '@/lib/treasury/onchain'
import { formatUsdc } from '@/lib/utils'

const POLL_MS = 30_000

export function useUserSpendingPool() {
  const { address, isConnected } = useAccount()
  const [balance, setBalance] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    if (!isConnected || !address) {
      setBalance(null)
      return
    }
    setLoading(true)
    void readUserTreasuryBalance(address as Address)
      .then(setBalance)
      .finally(() => setLoading(false))
  }, [address, isConnected])

  useEffect(() => {
    refresh()
    if (!isConnected || !address) return
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh, isConnected, address])

  const label =
    balance === null
      ? loading
        ? '…'
        : '—'
      : formatUsdc(balance)

  return { balance, loading, label, refresh, funded: balance !== null && balance > 0n }
}
