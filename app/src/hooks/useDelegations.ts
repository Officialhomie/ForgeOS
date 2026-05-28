'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphDelegation } from '@/lib/graph/mappers'
import { GET_DELEGATIONS } from '@/lib/graph/queries'
import type { GraphDelegationNode } from '@/lib/graph/types'
import { buildDelegationTree } from '@/lib/utils'
import { useDelegationsStore } from '@/stores/delegations.store'
import type { Delegation } from '@/types'

interface DelegationsResponse {
  delegations: GraphDelegationNode[]
}

function mergeDelegations(local: Delegation[], indexed: Delegation[]): Delegation[] {
  const byHash = new Map<string, Delegation>()
  for (const d of indexed) {
    byHash.set(d.hash.toLowerCase(), d)
  }
  for (const d of local) {
    byHash.set(d.hash.toLowerCase(), d)
  }
  return Array.from(byHash.values())
}

export function useDelegations(): {
  delegations: Delegation[]
  tree: Delegation | null
  loading: boolean
  error: string | null
} {
  const storeDelegations = useDelegationsStore((s) => s.delegations)
  const loading = useDelegationsStore((s) => s.loading)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)
  const setLoading = useDelegationsStore((s) => s.setLoading)

  const graphOn = isGraphEnabled()

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
    if (!graphOn) {
      setLoading(false)
      return
    }
    setLoading(query.isLoading)
    if (query.data) {
      const local = useDelegationsStore.getState().delegations
      setDelegations(mergeDelegations(local, query.data))
    }
  }, [graphOn, query.isLoading, query.data, setDelegations, setLoading])

  const delegations = useMemo(
    () =>
      graphOn && query.data
        ? mergeDelegations(storeDelegations, query.data)
        : storeDelegations,
    [graphOn, query.data, storeDelegations],
  )

  const tree = useMemo(() => buildDelegationTree(delegations), [delegations])

  return {
    delegations,
    tree,
    loading,
    error: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load delegations'
      : null,
  }
}
