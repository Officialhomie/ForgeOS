'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ONESHOT } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import {
  aggregateDailyPayments,
  mapGraphTreasury,
  mapTreasuryPayments,
  type TreasuryPaymentRow,
} from '@/lib/graph/mappers'
import { GET_DAILY_PAYMENTS, GET_TREASURY_SUMMARY } from '@/lib/graph/queries'
import type { GraphTreasuryEvent, GraphTreasuryState } from '@/lib/graph/types'
import { readTreasuryBalance } from '@/lib/treasury/onchain'
import { useTreasuryStore } from '@/stores/treasury.store'
import type { TreasuryState } from '@/types'

interface TreasurySummaryResponse {
  treasuryState: GraphTreasuryState | null
  treasuryEvents: GraphTreasuryEvent[]
}

interface DailyPaymentsResponse {
  treasuryEvents: { amount: string; timestamp: string }[]
}

export function useTreasury(): {
  treasury: TreasuryState | null
  loading: boolean
  error: string | null
  recentPayments: TreasuryPaymentRow[]
  dailySpend: { date: string; total: bigint }[]
  refetch: () => void
  topUp: (amountUsdc: string) => Promise<{ taskId: string }>
} {
  const treasury = useTreasuryStore((s) => s.treasury)
  const loading = useTreasuryStore((s) => s.loading)
  const setTreasury = useTreasuryStore((s) => s.setTreasury)
  const setLoading = useTreasuryStore((s) => s.setLoading)

  const [recentPayments, setRecentPayments] = useState<TreasuryPaymentRow[]>([])
  const [dailySpend, setDailySpend] = useState<{ date: string; total: bigint }[]>(
    [],
  )
  const [error, setError] = useState<string | null>(null)

  const graphOn = isGraphEnabled()

  const fetchLive = useCallback(async () => {
    // Always read the live on-chain balance — works even while the subgraph syncs
    const liveBalance = await readTreasuryBalance()

    // Subgraph queries may fail while the indexer is initializing — treat as non-fatal
    const since = String(Math.floor(Date.now() / 1000) - 30 * 86400)
    const [summaryResult, dailyResult] = await Promise.allSettled([
      queryGraph<TreasurySummaryResponse>(GET_TREASURY_SUMMARY, { paymentsFirst: 50 }),
      queryGraph<DailyPaymentsResponse>(GET_DAILY_PAYMENTS, { since }),
    ])

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null
    const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : null

    const mapped = mapGraphTreasury(
      summary?.treasuryState ?? null,
      summary?.treasuryEvents ?? [],
      {
        chainId: ONESHOT.CHAIN_ID,
        treasuryAddress: CONTRACTS.agentTreasury,
        liveBalance,
        monthlyCap: 500_000_000n,
      },
    )

    setTreasury(mapped)
    setRecentPayments(mapTreasuryPayments(summary?.treasuryEvents ?? []))
    setDailySpend(aggregateDailyPayments(daily?.treasuryEvents ?? []))
    setError(null)
    return mapped   // React Query v5 requires a non-undefined return value
  }, [setTreasury])

  const query = useQuery({
    queryKey: ['treasury', 'graph'],
    queryFn: fetchLive,
    enabled: graphOn,
    refetchInterval: GRAPH_POLL_MS,
    staleTime: GRAPH_POLL_MS / 2,
  })

  useEffect(() => {
    if (!graphOn) {
      setLoading(false)
      return
    }
    setLoading(query.isLoading)
    // fetchLive handles subgraph errors internally (allSettled) — only surface
    // errors that prevent even the live balance from loading.
    if (query.isError) {
      const msg = query.error instanceof Error ? query.error.message : ''
      const isSubgraphSyncing = msg.includes('not started syncing') || msg.includes('Subgraph')
      if (!isSubgraphSyncing) {
        setError(msg || 'Failed to load treasury')
      }
    }
  }, [graphOn, query.isLoading, query.isError, query.error, setLoading])

  const topUp = useCallback(async (amountUsdc: string): Promise<{ taskId: string }> => {
    const res = await fetch('/api/relay/fund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: ONESHOT.CHAIN_ID,
        amountUsdc,
        treasuryAddress: CONTRACTS.agentTreasury,
      }),
    })
    const data = (await res.json()) as { success?: boolean; taskId?: string; error?: string }
    if (!res.ok || !data.taskId) throw new Error(data.error ?? 'Fund failed')
    return { taskId: data.taskId }
  }, [])

  return {
    treasury,
    loading: loading || query.isLoading,
    error,
    recentPayments,
    dailySpend,
    refetch: () => void query.refetch(),
    topUp,
  }
}
