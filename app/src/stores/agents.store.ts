'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Agent, AgentId, AgentRuntimeConfig } from '@/types'

// BigInt values in Agent (earningsLifetime, earningsToday, gasSaved) cannot be
// serialised with standard JSON. Replace them with a tagged string on write and
// convert back on read so localStorage round-trips work correctly.
const bigintStorage = createJSONStorage(() => localStorage, {
  replacer: (_key, value) => (typeof value === 'bigint' ? `${value}__bigint` : value),
  reviver: (_key, value) =>
    typeof value === 'string' && value.endsWith('__bigint')
      ? BigInt(value.slice(0, -8))
      : value,
})

interface AgentsStore {
  agents: Record<AgentId, Agent>
  agentConfigs: Record<AgentId, AgentRuntimeConfig>
  installedMarketplaceIds: AgentId[]
  selectedAgentId: AgentId | null
  loading: boolean
  setAgents: (agents: Record<AgentId, Agent>) => void
  setAgentConfig: (id: AgentId, config: AgentRuntimeConfig) => void
  addInstalledAgent: (id: AgentId, agent?: Agent) => void
  setSelectedAgentId: (id: AgentId | null) => void
  setLoading: (loading: boolean) => void
}

export const useAgentsStore = create<AgentsStore>()(
  persist(
    (set) => ({
  agents: {} as Record<AgentId, Agent>,
  agentConfigs: {} as Record<AgentId, AgentRuntimeConfig>,
  installedMarketplaceIds: [],
  selectedAgentId: null,
  loading: false,
  setAgents: (agents) => set({ agents }),
  setAgentConfig: (id, config) =>
    set((state) => ({
      agentConfigs: { ...state.agentConfigs, [id]: config },
    })),
  addInstalledAgent: (id, agent) =>
    set((state) => ({
      installedMarketplaceIds: state.installedMarketplaceIds.includes(id)
        ? state.installedMarketplaceIds
        : [...state.installedMarketplaceIds, id],
      agents: agent ? { ...state.agents, [id]: agent } : state.agents,
    })),
      setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'forgeos-agents',
      storage: bigintStorage,
      partialize: (state) => ({
        agents: state.agents,
        installedMarketplaceIds: state.installedMarketplaceIds,
      }),
    },
  ),
)
