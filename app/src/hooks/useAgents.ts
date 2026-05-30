'use client'

import { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { GRAPH_POLL_MS, isGraphEnabled } from '@/lib/graph/config'
import { queryGraph } from '@/lib/graph/client'
import { mapGraphAgent } from '@/lib/graph/mappers'
import { GET_AGENTS } from '@/lib/graph/queries'
import type { GraphAgent } from '@/lib/graph/types'
import { useAgentsStore } from '@/stores/agents.store'
import type { Agent, AgentCategory, AgentId } from '@/types'

interface AgentsResponse {
  agents: GraphAgent[]
}

interface RegistryAgent {
  agentId: `0x${string}`
  creator: `0x${string}`
  name: string
  metadata: { description?: string; category?: string; promptTemplate?: string } | null
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
  const addInstalledAgent = useAgentsStore((s) => s.addInstalledAgent)

  const { address: walletAddress } = useAccount()
  const graphOn = isGraphEnabled()

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
    if (!graphOn) {
      setLoading(false)
      return
    }
    setLoading(query.isLoading)
    if (query.data) {
      // Merge graph data with locally-installed agents so that agents added
      // via marketplace install (hex IDs) are not wiped when the subgraph
      // returns results keyed by name-derived slugs.
      const current = useAgentsStore.getState().agents
      setAgents({ ...current, ...query.data })
    }
  }, [graphOn, query.isLoading, query.data, setAgents, setLoading])

  // When the subgraph is not configured, pull the user's own agents directly
  // from the registry API so the dashboard is not empty after a page reload.
  useEffect(() => {
    if (graphOn || !walletAddress) return
    fetch('/api/registry/agents')
      .then((r) => r.json())
      .then((data: { success: boolean; agents?: RegistryAgent[] }) => {
        if (!data.success || !data.agents) return
        const owned = data.agents.filter(
          (a) => a.creator.toLowerCase() === walletAddress.toLowerCase(),
        )
        const current = useAgentsStore.getState().agents
        for (const a of owned) {
          if (current[a.agentId as AgentId]) continue
          addInstalledAgent(a.agentId as AgentId, {
            id: a.agentId as AgentId,
            name: a.name,
            description: a.metadata?.description ?? '',
            icon: '🤖',
            category: (a.metadata?.category as AgentCategory | undefined) ?? 'data',
            status: 'active',
            installedAt: null,
            lastRunAt: null,
            nextRunAt: null,
            runCount: 0,
            successCount: 0,
            failureCount: 0,
            delegation: null,
            redelegations: [],
            earningsLifetime: 0n,
            earningsToday: 0n,
            gasSaved: 0n,
            config: {
              veniceModel: 'llama-3.3-70b',
              scheduleInterval: 3600,
              customInstructions: a.metadata?.promptTemplate ?? '',
            },
          })
        }
      })
      .catch(() => {
        // Registry API unavailable — rely on persisted store
      })
  }, [graphOn, walletAddress, addInstalledAgent])

  return {
    agents: Object.values(agents) as Agent[],
    loading,
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
