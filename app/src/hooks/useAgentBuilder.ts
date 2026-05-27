'use client'

import { useState, useCallback } from 'react'
import { AGENT_TEMPLATES } from '@/lib/agents/templates'
import type { AgentTemplate } from '@/lib/agents/templates'
import type { AgentId, Hash } from '@/types'
import { buildActivationPermissions } from '@/lib/delegation/buildPermissions'
import { CONTRACTS } from '@/lib/contracts'
import { useOsStore } from '@/stores/os.store'

export type BuilderStep =
  | 'idle'
  | 'configuring'
  | 'testing'
  | 'approving'
  | 'publishing'
  | 'deployed'

const DRAFT_KEY = 'forgeos_agent_draft_v1'

export interface DeployedAgent {
  agentId: string
  delegationHash: Hash | null
  taskId: string | null
  ipfsUri: string | null
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
  saveDraft: () => void
  loadDraft: () => boolean
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

  const rootDelegation = useOsStore((s) => s.rootDelegation)

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

  const saveDraft = useCallback(() => {
    if (!selectedTemplate) return
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        templateId: selectedTemplate.id,
        prompt,
        spendCap,
        intervalHours,
        configValues,
      }),
    )
  }, [selectedTemplate, prompt, spendCap, intervalHours, configValues])

  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const d = JSON.parse(raw) as {
        templateId: AgentId
        prompt: string
        spendCap: number
        intervalHours: number
        configValues: Record<string, string | number | boolean>
      }
      selectTemplate(d.templateId)
      setPrompt(d.prompt)
      setSpendCap(d.spendCap)
      setIntervalHours(d.intervalHours)
      setConfigValues(d.configValues)
      return true
    } catch {
      return false
    }
  }, [selectTemplate])

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
    if (!selectedTemplate || !rootDelegation) {
      setError('Activate ForgeOS before approving agent permissions')
      return
    }
    setStep('approving')
    setError(null)
    try {
      const provider = (
        window as unknown as {
          ethereum?: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }
        }
      ).ethereum
      if (!provider) throw new Error('MetaMask not found')

      const permissions = buildActivationPermissions(CONTRACTS.osKernel, {
        monthlyCapUsdc: spendCap,
      })

      const granted = (await provider.request({
        method: 'wallet_requestExecutionPermissions',
        params: permissions,
      })) as Array<{ context?: string }>

      const sig = granted[0]?.context as Hash | undefined
      if (!sig) throw new Error('No delegation signature returned')
      setApprovedDelegationHash(sig)
      setStep('configuring')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approval failed')
      setStep('configuring')
    }
  }, [selectedTemplate, rootDelegation, spendCap])

  const deployAgent = useCallback(async () => {
    if (!selectedTemplate) return
    if (!approvedDelegationHash && !rootDelegation) {
      setError('Approve permissions before publishing')
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
            process.env.NEXT_PUBLIC_DEFI_AGENT_ADDRESS ??
            '0x0000000000000000000000000000000000000000',
          configSchema: selectedTemplate.configSchema,
        }),
      })

      const data = (await res.json()) as
        | { success: true; agentId: string; ipfsUri: string; taskId: string }
        | { success: false; error: string }

      if (!data.success) throw new Error(data.error)

      setDeployedAgent({
        agentId: data.agentId,
        delegationHash: approvedDelegationHash,
        taskId: data.taskId,
        ipfsUri: data.ipfsUri,
      })
      setStep('deployed')
      localStorage.removeItem(DRAFT_KEY)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setStep('configuring')
    }
  }, [selectedTemplate, prompt, spendCap, approvedDelegationHash, rootDelegation])

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
    saveDraft,
    loadDraft,
    testAgent,
    approveAgent,
    deployAgent,
    reset,
  }
}
