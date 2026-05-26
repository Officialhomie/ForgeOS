'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ONESHOT } from '@/lib/constants'
import { isDemoMode } from '@/lib/demo'
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
import { MOCK_TREASURY } from '@/lib/mock-data'
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

  const demo = isDemoMode()
  const graphOn = isGraphEnabled() && !demo

  const fetchLive = useCallback(async () => {
    const [summary, liveBalance] = await Promise.all([
      queryGraph<TreasurySummaryResponse>(GET_TREASURY_SUMMARY, {
        paymentsFirst: 50,
      }),
      readTreasuryBalance(),
    ])

    const since = String(Math.floor(Date.now() / 1000) - 30 * 86400)
    const daily = await queryGraph<DailyPaymentsResponse>(GET_DAILY_PAYMENTS, {
      since,
    })

    const mapped = mapGraphTreasury(
      summary.treasuryState,
      summary.treasuryEvents,
      {
        chainId: ONESHOT.CHAIN_ID,
        treasuryAddress: CONTRACTS.agentTreasury,
        liveBalance,
        monthlyCap: 500_000_000n,
      },
    )

    setTreasury(mapped)
    setRecentPayments(mapTreasuryPayments(summary.treasuryEvents))
    setDailySpend(aggregateDailyPayments(daily.treasuryEvents))
    setError(null)
  }, [setTreasury])

  const query = useQuery({
    queryKey: ['treasury', 'graph'],
    queryFn: fetchLive,
    enabled: graphOn,
    refetchInterval: GRAPH_POLL_MS,
    staleTime: GRAPH_POLL_MS / 2,
  })

  useEffect(() => {
    if (demo) {
      setTreasury(MOCK_TREASURY)
      setRecentPayments([])
      setDailySpend([])
      setLoading(false)
      setError(null)
      return
    }

    if (!graphOn) {
      setTreasury(MOCK_TREASURY)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(query.isLoading)
    if (query.isError) {
      setError(
        query.error instanceof Error
          ? query.error.message
          : 'Failed to load treasury',
      )
      setTreasury(MOCK_TREASURY)
    }
  }, [
    demo,
    graphOn,
    query.isLoading,
    query.isError,
    query.error,
    setTreasury,
    setLoading,
  ])

  return {
    treasury,
    loading: demo ? false : loading || query.isLoading,
    error,
    recentPayments: demo ? [] : recentPayments,
    dailySpend: demo
      ? buildDemoDailySpend()
      : dailySpend,
    refetch: () => void query.refetch(),
  }
}

function buildDemoDailySpend(): { date: string; total: bigint }[] {
  const rows: { date: string; total: bigint }[] = []
  const now = Date.now()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    rows.push({
      date: key,
      total: i % 7 === 0 ? 12_000_000n : i % 3 === 0 ? 5_000_000n : 0n,
    })
  }
  return rows
}
