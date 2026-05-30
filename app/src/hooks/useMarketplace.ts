/**
 * useMarketplace
 *
 * Fetches agents from ForgeOSRegistry and provides install functionality.
 * Install uses existing OS root delegation when present, else ERC-7715 via Flask.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { createClient, custom } from 'viem'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { useOsStore } from '@/stores/os.store'
import { useAgentsStore } from '@/stores/agents.store'
import {
  createRootDelegationStruct,
  kitDelegationToForge,
} from '@/lib/delegation/createRootDelegation'
import { buildActivationPermissions } from '@/lib/delegation/buildPermissions'
import { rootDelegationNeedsRelayResign } from '@/lib/delegation/needs-relay-resign'
import { getRelayTargetAddress } from '@/lib/oneshot/client'
import { isErc7715Busy, withErc7715Lock } from '@/lib/wallet/erc7715-lock'
import { forgeChain } from '@/lib/wagmi/chains'
import { ensureForgeChain } from '@/lib/wagmi/ensure-forge-chain'
import {
  formatErc7715Error,
  getErc7715Provider,
  getEthereumProviderDiagnostics,
  probeErc7715RpcSupport,
  refreshWalletRuntimeCache,
} from '@/lib/wagmi/ethereum-provider'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Agent, AgentCategory, AgentId, Hash } from '@/types'

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
  pending?: boolean
}

export interface UseMarketplaceReturn {
  agents: MarketplaceAgent[]
  loading: boolean
  error: string | null
  installAgent: (agentId: `0x${string}`) => Promise<{ success: boolean; error?: string }>
  refetch: () => Promise<void>
}

function spendCapUsdcFromCaveat(caveatTemplate: unknown): number {
  if (!Array.isArray(caveatTemplate)) return 500
  for (const entry of caveatTemplate) {
    if (!entry || typeof entry !== 'object') continue
    const terms = (entry as { terms?: { maxAmount?: string | number } }).terms
    if (terms?.maxAmount != null) {
      const raw = Number(terms.maxAmount)
      if (Number.isFinite(raw) && raw > 0) {
        return raw >= 1_000_000 ? raw / 1_000_000 : raw
      }
    }
  }
  return 500
}

function buildInstalledAgent(
  agent: MarketplaceAgent,
  delegation: Agent['delegation'],
): Agent {
  return {
    id: agent.agentId as AgentId,
    name: agent.name,
    description: agent.metadata?.description ?? '',
    icon: '🤖',
    category: (agent.metadata?.category as AgentCategory | undefined) ?? 'data',
    status: 'active',
    installedAt: Math.floor(Date.now() / 1000),
    lastRunAt: null,
    nextRunAt: null,
    runCount: 0,
    successCount: 0,
    failureCount: 0,
    delegation,
    redelegations: [],
    earningsLifetime: 0n,
    earningsToday: 0n,
    gasSaved: 0n,
    config: {
      veniceModel: 'llama-3.3-70b',
      scheduleInterval: 3600,
      customInstructions: agent.metadata?.promptTemplate ?? '',
    },
  }
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useMarketplace(): UseMarketplaceReturn {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const rootDelegation = useOsStore((s) => s.rootDelegation)

  const fetchAgents = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        forceRefresh ? '/api/registry/agents?refresh=1' : '/api/registry/agents',
      )
      const data = (await res.json()) as {
        success: boolean
        agents?: MarketplaceAgent[]
        error?: string
      }
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
      if (!address) {
        return { success: false, error: 'Connect your wallet first (top bar).' }
      }

      const agent = agents.find((a) => a.agentId === agentId)
      if (!agent) {
        return { success: false, error: 'Agent not found. Refresh the marketplace and try again.' }
      }

      if (!rootDelegation?.hash) {
        return {
          success: false,
          error: 'Finish setup on the Activate page first (Permissions step).',
        }
      }

      try {
        if (isErc7715Busy()) {
          return {
            success: false,
            error:
              'MetaMask is already processing a permission request. Close that popup or finish it, then try again.',
          }
        }

        let delegation = rootDelegation

        if (await rootDelegationNeedsRelayResign(rootDelegation)) {
          if (chainId !== ACTIVATION_CHAIN_ID) {
            await ensureForgeChain(switchChainAsync)
          }

          await refreshWalletRuntimeCache()
          const diag = getEthereumProviderDiagnostics()
          if (diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) {
            return {
              success: false,
              error:
                'Dual MetaMask extensions detected. Disable regular MetaMask, keep only Flask, hard-refresh, and reconnect.',
            }
          }
          if (diag.kind === 'metamask' && !diag.hasFlaskCandidate) {
            return {
              success: false,
              error:
                'Marketplace install needs MetaMask Flask with ERC-7715. Disable standard MetaMask and reconnect with Flask.',
            }
          }

          const provider = await getErc7715Provider()
          if (!provider) {
            return { success: false, error: 'MetaMask Flask not found. Connect Flask and retry.' }
          }

          const rpcOk = await probeErc7715RpcSupport(provider)
          if (!rpcOk) {
            return {
              success: false,
              error:
                'This MetaMask build does not support ERC-7715. Use MetaMask Flask with execution permissions enabled.',
            }
          }

          const relayTarget = await getRelayTargetAddress(ACTIVATION_CHAIN_ID)
          const monthlyCap = spendCapUsdcFromCaveat(agent.metadata?.caveatTemplate)
          const permissions = buildActivationPermissions(relayTarget, { monthlyCapUsdc: monthlyCap })

          const erc7715Client = createClient({
            chain: forgeChain,
            transport: custom(provider),
          }).extend(erc7715ProviderActions())

          const granted = await withErc7715Lock(() =>
            erc7715Client.requestExecutionPermissions(permissions),
          )

          const signature = granted[0]?.context as Hash | undefined
          if (!signature || signature === '0x') {
            return {
              success: false,
              error:
                'MetaMask did not return a delegation signature. Approve the permission popup and try again.',
            }
          }

          const kitDel = await createRootDelegationStruct({
            delegator: address,
            delegate: relayTarget,
          })
          delegation = kitDelegationToForge(kitDel, signature)
          delegation.agentId = agentId as AgentId
          useOsStore.getState().setRootDelegation(delegation)
        }

        const stubAgent = buildInstalledAgent(agent, delegation)
        useAgentsStore.getState().addInstalledAgent(agentId as AgentId, stubAgent)

        void fetch('/api/delegations/bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smartAccountAddress: address,
            delegations: [delegation],
          }),
        })

        return { success: true }
      } catch (e) {
        return { success: false, error: formatErc7715Error(e) }
      }
    },
    [address, agents, chainId, rootDelegation, switchChainAsync],
  )

  return {
    agents,
    loading,
    error,
    installAgent,
    refetch: () => fetchAgents(true),
  }
}
