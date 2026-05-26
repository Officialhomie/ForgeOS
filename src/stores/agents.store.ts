'use client'

import { create } from 'zustand'
import type { Agent, AgentId } from '@/types'

interface AgentsStore {
  agents: Record<AgentId, Agent>
  selectedAgentId: AgentId | null
  loading: boolean
  setAgents: (agents: Record<AgentId, Agent>) => void
  setSelectedAgentId: (id: AgentId | null) => void
  setLoading: (loading: boolean) => void
}

export const useAgentsStore = create<AgentsStore>((set) => ({
  agents: {} as Record<AgentId, Agent>,
  selectedAgentId: null,
  loading: false,
  setAgents: (agents) => set({ agents }),
  setSelectedAgentId: (selectedAgentId) => set({ selectedAgentId }),
  setLoading: (loading) => set({ loading }),
}))
