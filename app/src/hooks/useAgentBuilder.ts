'use client'

import { useState, useCallback } from 'react'
import { AGENT_TEMPLATES } from '@/lib/agents/templates'
import type { AgentTemplate } from '@/lib/agents/templates'
import type { AgentCategory, AgentId, Hash } from '@/types'
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
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'
import { createClient, custom } from 'viem'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useOsStore } from '@/stores/os.store'
import { useActivationStore } from '@/stores/activation.store'
import { useAgentsStore } from '@/stores/agents.store'

export type BuilderStep =
  | 'idle'
  | 'configuring'
  | 'testing'
  | 'approving'
  | 'publishing'
  | 'deployed'

export interface DeployedAgent {
  agentId: string
  delegationHash: Hash | null
  taskId: string | null
  ipfsUri: string | null
  metadataSource?: 'pinata' | 'inline'
  pinataError?: string | null
}

export interface UseAgentBuilderReturn {
  step: BuilderStep
  selectedTemplate: AgentTemplate | null
  configValues: Record<string, string | number | boolean>
  prompt: string
  spendCap: number
  intervalHours: number
  testResult: string | null
  deployedAgent: DeployedAgent | null
  error: string | null
  selectTemplate: (id: AgentId) => void
  setConfigValues: (values: Record<string, string | number | boolean>) => void
  setPrompt: (prompt: string) => void
  setSpendCap: (cap: number) => void
  setIntervalHours: (hours: number) => void
  testAgent: () => Promise<void>
  approveAgent: () => Promise<void>
  deployAgent: () => Promise<void>
  reset: () => void
}

export function useAgentBuilder(): UseAgentBuilderReturn {
  const [step, setStep] = useState<BuilderStep>('idle')
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({})
  const [prompt, setPrompt] = useState('')
  const [spendCap, setSpendCap] = useState(500)
  const [intervalHours, setIntervalHours] = useState(1)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [deployedAgent, setDeployedAgent] = useState<DeployedAgent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approvedDelegationHash, setApprovedDelegationHash] = useState<Hash | null>(null)

  const { address: walletAddress } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const rootDelegation = useOsStore((s) => s.rootDelegation)
  const smartAccountAddress = useActivationStore((s) =>
    walletAddress ? s.getWallet(walletAddress).smartAccountAddress : null,
  )

  const selectTemplate = useCallback((id: AgentId) => {
    const template = AGENT_TEMPLATES.find((t) => t.id === id)
    if (!template) return

    setSelectedTemplate(template)
    setPrompt(template.defaultPrompt)
    setIntervalHours(template.defaultIntervalSeconds / 3600)

    const defaults: Record<string, string | number | boolean> = {}
    for (const [key, field] of Object.entries(template.configSchema)) {
      if (field.defaultValue !== undefined) {
        defaults[key] = field.defaultValue
      }
    }
    setConfigValues(defaults)
    setStep('configuring')
  }, [])


  const testAgent = useCallback(async () => {
    if (!selectedTemplate) return
    setStep('testing')
    setError(null)
    setTestResult(null)
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: prompt }),
      })
      const data = (await res.json()) as
        | { success: true; actionPlan: { summary: string } }
        | { success: false; error: string }
      if (!data.success) throw new Error(data.error)
      setTestResult(data.actionPlan.summary)
      setStep('configuring')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
      setStep('configuring')
    }
  }, [selectedTemplate, prompt])

  const approveAgent = useCallback(async () => {
    if (!selectedTemplate) {
      setError('Select an agent template first')
      return
    }
    if (isErc7715Busy()) {
      setError('MetaMask is already processing a permission request. Finish or close that popup first.')
      return
    }
    setStep('approving')
    setError(null)
    try {
      if (rootDelegation && !(await rootDelegationNeedsRelayResign(rootDelegation))) {
        setApprovedDelegationHash(rootDelegation.hash)
        setStep('configuring')
        setError(null)
        return
      }
      if (!walletAddress) throw new Error('Connect wallet first')
      if (chainId !== ACTIVATION_CHAIN_ID) {
        await ensureForgeChain(switchChainAsync)
      }

      await refreshWalletRuntimeCache()
      const diag = getEthereumProviderDiagnostics()
      if (diag.hasFlaskCandidate && diag.hasStandardMetaMaskCandidate) {
        throw new Error(
          'Dual MetaMask extensions detected. Disable regular MetaMask, keep only Flask, hard-refresh, reconnect.',
        )
      }
      if (diag.kind === 'metamask' && !diag.hasFlaskCandidate) {
        throw new Error(
          'Connected to standard MetaMask, not Flask. Disable standard MetaMask and reconnect with Flask only.',
        )
      }

      const provider = await getErc7715Provider()
      if (!provider) throw new Error('MetaMask not found')

      const rpcOk = await probeErc7715RpcSupport(provider)
      if (!rpcOk) {
        throw new Error(
          'wallet_getSupportedExecutionPermissions is not available on this MetaMask Flask build. Install a Flask version with ERC-7715 enabled.',
        )
      }

      const relayTarget = await getRelayTargetAddress(ACTIVATION_CHAIN_ID)
      const permissions = buildActivationPermissions(relayTarget, {
        monthlyCapUsdc: spendCap,
      })

      const erc7715Client = createClient({
        chain: forgeChain,
        transport: custom(provider),
      }).extend(erc7715ProviderActions())

      const granted = await withErc7715Lock(() =>
        erc7715Client.requestExecutionPermissions(permissions),
      )

      const sig = granted[0]?.context as Hash | undefined
      if (!sig || sig === '0x') {
        throw new Error(
          'MetaMask did not return a delegation signature. Approve the permission request and retry.',
        )
      }
      setApprovedDelegationHash(sig)
      setStep('configuring')
    } catch (e) {
      setError(formatErc7715Error(e))
      setStep('configuring')
    }
  }, [selectedTemplate, spendCap, walletAddress, chainId, switchChainAsync, rootDelegation])

  const deployAgent = useCallback(async () => {
    if (!selectedTemplate) return
    if (!rootDelegation) {
      setError(
        'Finish OS activation first (/activate → Permissions). Your root delegation is required to publish on-chain.',
      )
      return
    }
    if (!smartAccountAddress) {
      setError('Deploy your Forge smart account in activation before publishing.')
      return
    }

    setStep('publishing')
    setError(null)

    try {
      const res = await fetch('/api/registry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          category: selectedTemplate.category,
          promptTemplate: prompt,
          caveatTemplate: selectedTemplate.defaultCaveats.map((c) => ({
            ...c,
            defaultTerms: {
              ...c.defaultTerms,
              maxAmount: String(Math.floor(spendCap * 1_000_000)),
            },
          })),
          agentAddress:
            process.env.NEXT_PUBLIC_DEFI_AGENT_ADDRESS ?? smartAccountAddress,
          smartAccountAddress,
          signedDelegations: [rootDelegation],
          configSchema: selectedTemplate.configSchema,
        }),
      })

      const data = (await res.json()) as
        | {
            success: true
            agentId: string
            ipfsUri: string
            taskId: string
            metadataSource?: 'pinata' | 'inline'
            pinataError?: string | null
          }
        | { success: false; error: string }

      if (!res.ok || !data.success) {
        throw new Error('error' in data ? data.error : `Publish failed (${res.status})`)
      }

      setDeployedAgent({
        agentId: data.agentId,
        delegationHash: approvedDelegationHash,
        taskId: data.taskId,
        ipfsUri: data.ipfsUri,
        metadataSource: data.metadataSource,
        pinataError: data.pinataError ?? null,
      })

      // Fetch the real agent record the server just added to pendingPublished[].
      // Use ?refresh=1 so the cache is busted and the pending agent is included.
      let realName = selectedTemplate.name
      let realDescription = selectedTemplate.description
      let realCategory = selectedTemplate.category as AgentCategory
      let realPrompt = prompt
      try {
        const regRes = await fetch('/api/registry/agents?refresh=1')
        const regData = (await regRes.json()) as {
          success: boolean
          agents?: Array<{
            agentId: `0x${string}`
            name: string
            metadata: { description?: string; category?: string; promptTemplate?: string } | null
          }>
        }
        const found = regData.success
          ? (regData.agents ?? []).find((a) => a.agentId === data.agentId)
          : null
        if (found) {
          realName = found.name
          realDescription = found.metadata?.description ?? realDescription
          realCategory = (found.metadata?.category as AgentCategory | undefined) ?? realCategory
          realPrompt = found.metadata?.promptTemplate ?? realPrompt
        }
      } catch {
        // Registry API unavailable — fall back to template values
      }

      useAgentsStore.getState().addInstalledAgent(data.agentId as AgentId, {
        id: data.agentId as AgentId,
        name: realName,
        description: realDescription,
        icon: '🤖',
        category: realCategory,
        status: 'active',
        installedAt: Math.floor(Date.now() / 1000),
        lastRunAt: null,
        nextRunAt: null,
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        delegation: rootDelegation,
        redelegations: [],
        earningsLifetime: 0n,
        earningsToday: 0n,
        gasSaved: 0n,
        config: {
          veniceModel: 'llama-3.3-70b',
          scheduleInterval: selectedTemplate.defaultIntervalSeconds,
          customInstructions: realPrompt,
        },
      })
      setStep('deployed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setStep('configuring')
    }
  }, [
    selectedTemplate,
    prompt,
    spendCap,
    approvedDelegationHash,
    rootDelegation,
    smartAccountAddress,
  ])

  const reset = useCallback(() => {
    setStep('idle')
    setSelectedTemplate(null)
    setConfigValues({})
    setPrompt('')
    setSpendCap(500)
    setIntervalHours(1)
    setDeployedAgent(null)
    setTestResult(null)
    setApprovedDelegationHash(null)
    setError(null)
  }, [])

  return {
    step,
    selectedTemplate,
    configValues,
    prompt,
    spendCap,
    intervalHours,
    testResult,
    deployedAgent,
    error,
    selectTemplate,
    setConfigValues,
    setPrompt,
    setSpendCap,
    setIntervalHours,
    testAgent,
    approveAgent,
    deployAgent,
    reset,
  }
}
