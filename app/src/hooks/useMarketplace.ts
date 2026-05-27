/**
 * useMarketplace
 *
 * Fetches agents from ForgeOSRegistry and provides install functionality.
 * Install triggers wallet_requestExecutionPermissions (ERC-7715) via MetaMask.
 *
 * Track evidence:
 *  - Best Agent: marketplace install flow with ERC-7715
 *  - Best A2A: parent delegation hash passed to create sub-delegation chain
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { useOsStore } from '@/stores/os.store'
import { useAgentsStore } from '@/stores/agents.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import {
  createRootDelegationStruct,
  kitDelegationToForge,
} from '@/lib/delegation/createRootDelegation'
import type { Agent, AgentId } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface MarketplaceAgent {
  agentId: `0x${string}`
  creator: `0x${string}`
  name: string
  metadataUri: string
  metadata: {
    description?: string
    category?: string
    version?: string
    promptTemplate?: string
    caveatTemplate?: object
    agentAddress?: string
  } | null
  blockNumber: string | null
  txHash: `0x${string}` | null
}

export interface UseMarketplaceReturn {
  agents: MarketplaceAgent[]
  loading: boolean
  error: string | null
  installAgent: (agentId: `0x${string}`) => Promise<{ success: boolean; error?: string }>
  refetch: () => Promise<void>
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useMarketplace(): UseMarketplaceReturn {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { address } = useAccount()
  const rootDelegation = useOsStore((s: { rootDelegation: import('@/types').Delegation | null }) => s.rootDelegation)

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/registry/agents')
      const data = (await res.json()) as { success: boolean; agents?: MarketplaceAgent[]; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Failed to fetch agents')
      setAgents(data.agents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const installAgent = useCallback(
    async (agentId: `0x${string}`): Promise<{ success: boolean; error?: string }> => {
      if (!address) return { success: false, error: 'Wallet not connected' }
      if (!rootDelegation?.hash) return { success: false, error: 'OS not activated — complete activation first' }

      try {
        // 1. Get install params from server
        const res = await fetch('/api/registry/install', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            userAddress: address,
            parentDelegationHash: rootDelegation.hash,
          }),
        })

        const data = (await res.json()) as {
          success: boolean
          permissionRequest?: object
          error?: string
        }

        if (!data.success || !data.permissionRequest) {
          return { success: false, error: data.error ?? 'Install failed' }
        }

        // 2. Submit ERC-7715 permission request to MetaMask Flask
        const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> } }).ethereum
        if (!provider) return { success: false, error: 'MetaMask not found' }

        const granted = await provider.request({
          method: 'wallet_requestExecutionPermissions',
          params: [data.permissionRequest],
        })

        const signature = Array.isArray(granted) && granted[0]?.context
          ? (granted[0].context as `0x${string}`)
          : null
        if (!signature || signature === '0x') {
          return { success: false, error: 'Permission approval not returned by wallet' }
        }

        const kitDel = await createRootDelegationStruct({ delegator: address })
        const forgeDel = kitDelegationToForge(kitDel, signature)
        forgeDel.agentId = agentId as AgentId

        useDelegationsStore.getState().setDelegations([
          ...useDelegationsStore.getState().delegations,
          forgeDel,
        ])

        const stubAgent: Agent = {
          id: agentId as AgentId,
          name: agents.find((a) => a.agentId === agentId)?.name ?? 'Installed agent',
          description:
            agents.find((a) => a.agentId === agentId)?.metadata?.description ?? '',
          icon: '🤖',
          category: 'data',
          status: 'active',
          installedAt: Math.floor(Date.now() / 1000),
          lastRunAt: null,
          nextRunAt: null,
          runCount: 0,
          successCount: 0,
          failureCount: 0,
          delegation: forgeDel,
          redelegations: [],
          earningsLifetime: 0n,
          earningsToday: 0n,
          gasSaved: 0n,
          config: {
            veniceModel: 'llama-3.3-70b',
            scheduleInterval: 3600,
            customInstructions: '',
          },
        }
        useAgentsStore.getState().addInstalledAgent(agentId as AgentId, stubAgent)

        void fetch('/api/delegations/bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smartAccountAddress: address,
            delegations: useDelegationsStore.getState().delegations,
          }),
        })

        return { success: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Install failed'
        return { success: false, error: msg }
      }
    },
    [address, rootDelegation],
  )

  return { agents, loading, error, installAgent, refetch: fetchAgents }
}
