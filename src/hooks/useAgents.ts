'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isDemoMode } from '@/lib/demo'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphAgent } from '@/lib/graph/mappers'
import { GET_AGENTS } from '@/lib/graph/queries'
import type { GraphAgent } from '@/lib/graph/types'
import { MOCK_AGENTS } from '@/lib/mock-data'
import { useAgentsStore } from '@/stores/agents.store'
import type { Agent, AgentId } from '@/types'

interface AgentsResponse {
  agents: GraphAgent[]
}

export function useAgents(): {
  agents: Agent[]
  loading: boolean
  error: string | null
} {
  const agents = useAgentsStore((s) => s.agents)
  const loading = useAgentsStore((s) => s.loading)
  const setAgents = useAgentsStore((s) => s.setAgents)
  const setLoading = useAgentsStore((s) => s.setLoading)

  const demo = isDemoMode()
  const graphOn = isGraphEnabled() && !demo

  const query = useQuery({
    queryKey: ['agents', 'graph'],
    queryFn: async () => {
      const data = await queryGraph<AgentsResponse>(GET_AGENTS, { first: 50 })
      const mapped = data.agents.map(mapGraphAgent)
      return Object.fromEntries(mapped.map((a) => [a.id, a])) as Record<
        AgentId,
        Agent
      >
    },
    enabled: graphOn,
    refetchInterval: GRAPH_POLL_MS,
  })

  useEffect(() => {
    if (demo) {
      setAgents(MOCK_AGENTS)
      setLoading(false)
      return
    }
    if (!graphOn) {
      setAgents(MOCK_AGENTS)
      setLoading(false)
      return
    }
    setLoading(query.isLoading)
    if (query.data) {
      setAgents(query.data)
    }
  }, [demo, graphOn, query.isLoading, query.data, setAgents, setLoading])

  return {
    agents: Object.values(agents) as Agent[],
    loading: demo ? false : loading,
    error: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'Failed to load agents'
      : null,
  }
}

export function useAgent(id: AgentId | null): Agent | undefined {
  const agents = useAgentsStore((s) => s.agents)
  if (!id) return undefined
  return agents[id]
}
