'use client'

import { create } from 'zustand'
import type { Agent, AgentId, AgentRuntimeConfig } from '@/types'

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

export const useAgentsStore = create<AgentsStore>((set) => ({
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
}))
