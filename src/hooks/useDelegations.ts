'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode } from '@/lib/demo'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphDelegation } from '@/lib/graph/mappers'
import { GET_DELEGATIONS } from '@/lib/graph/queries'
import type { GraphDelegationNode } from '@/lib/graph/types'
import { MOCK_DELEGATIONS } from '@/lib/mock-data'
import { buildDelegationTree } from '@/lib/utils'
import { useDelegationsStore } from '@/stores/delegations.store'
import type { Delegation } from '@/types'

interface DelegationsResponse {
  delegations: GraphDelegationNode[]
}

export function useDelegations(): {
  delegations: Delegation[]
  tree: Delegation | null
  loading: boolean
  error: string | null
} {
  const delegations = useDelegationsStore((s) => s.delegations)
  const loading = useDelegationsStore((s) => s.loading)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)
  const setLoading = useDelegationsStore((s) => s.setLoading)

  const demo = isDemoMode()
  const graphOn = isGraphEnabled() && !demo

  const query = useQuery({
    queryKey: ['delegations', 'graph'],
    queryFn: async () => {
      const data = await queryGraph<DelegationsResponse>(GET_DELEGATIONS, {
        first: 100,
      })
      return data.delegations.map(mapGraphDelegation)
    },
    enabled: graphOn,
    refetchInterval: GRAPH_POLL_MS,
  })

  useEffect(() => {
    if (demo) {
      setDelegations(Object.values(MOCK_DELEGATIONS))
      setLoading(false)
      return
    }
    if (!graphOn) {
      setDelegations(Object.values(MOCK_DELEGATIONS))
      setLoading(false)
      return
    }
    setLoading(query.isLoading)
    if (query.data) {
      setDelegations(query.data)
    }
  }, [demo, graphOn, query.isLoading, query.data, setDelegations, setLoading])

  const tree = useMemo(() => buildDelegationTree(delegations), [delegations])

  return {
    delegations,
    tree,
    loading: demo ? false : loading,
    error: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load delegations'
      : null,
  }
}
