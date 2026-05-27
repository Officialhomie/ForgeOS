/**
 * useAgentExecute
 *
 * Reusable hook that executes an intent through the full pipeline:
 *   1. Reads delegation hashes from stores
 *   2. Chooses A2A (2-hop) or single-hop path based on plan
 *   3. Submits to /api/a2a/execute or /api/execute
 *   4. Returns taskId for SSE tracking
 *
 * Used by CommandBarModal and the agent runtime cron runner.
 *
 * Track evidence:
 *  - Best A2A: automatically injects 3-hop delegation chain for 2-hop plans
 *  - Best Agent: centralised execution logic, no duplication
 */

'use client'

import { useState, useCallback } from 'react'
import { useOsStore } from '@/stores/os.store'
import { useDelegationsStore } from '@/stores/delegations.store'
import { useAccount } from 'wagmi'
import type { ActionPlan, Hash } from '@/types'

// ─── SERIALISATION ────────────────────────────────────────────────────────────

function serialisePlan(plan: ActionPlan) {
  return {
    ...plan,
    estimatedCost: plan.estimatedCost.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    actions: plan.actions.map((a) => ({
      ...a,
      value: a.value.toString(),
    })),
  }
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export interface AgentExecuteResult {
  taskId: string
  plan: ActionPlan
  isA2A: boolean
}

export interface UseAgentExecuteReturn {
  executeIntent: (intent: string) => Promise<AgentExecuteResult>
  executePlan: (plan: ActionPlan) => Promise<{ taskId: string; isA2A: boolean }>
  isExecuting: boolean
  error: string | null
  clearError: () => void
}

export function useAgentExecute(): UseAgentExecuteReturn {
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rootDelegation = useOsStore((s) => s.rootDelegation)
  const subDelegation = useDelegationsStore((s) => s.subDelegation)
  const reDelegation = useDelegationsStore((s) => s.reDelegation)
  const delegations = useDelegationsStore((s) => s.delegations)
  const { address: userAddress } = useAccount()

  // ── Execute a natural language intent end-to-end ──────────────────────────

  const executeIntent = useCallback(
    async (intent: string): Promise<AgentExecuteResult> => {
      setIsExecuting(true)
      setError(null)

      try {
        // Step 1: Parse intent via Venice
        const commandRes = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent }),
        })

        const commandData = (await commandRes.json()) as
          | { success: true; actionPlan: ReturnType<typeof serialisePlan> }
          | { success: false; error: string; code: string }

        if (!commandData.success) {
          throw new Error(commandData.error)
        }

        const plan: ActionPlan = {
          ...commandData.actionPlan,
          estimatedCost: BigInt(commandData.actionPlan.estimatedCost),
          estimatedGas: BigInt(commandData.actionPlan.estimatedGas),
          actions: commandData.actionPlan.actions.map((a) => ({
            ...a,
            value: BigInt(a.value),
          })),
        }

        // Step 2: Execute the plan
        const { taskId, isA2A } = await executePlanInternal(plan)

        return { taskId, plan, isA2A }
      } finally {
        setIsExecuting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootDelegation, subDelegation, reDelegation, userAddress],
  )

  // ── Execute a pre-built ActionPlan ────────────────────────────────────────

  const executePlan = useCallback(
    async (plan: ActionPlan): Promise<{ taskId: string; isA2A: boolean }> => {
      setIsExecuting(true)
      setError(null)
      try {
        return await executePlanInternal(plan)
      } finally {
        setIsExecuting(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rootDelegation, subDelegation, reDelegation, userAddress],
  )

  // ── Internal: choose A2A vs single-hop, inject delegation hashes ──────────

  async function executePlanInternal(
    plan: ActionPlan,
  ): Promise<{ taskId: string; isA2A: boolean }> {
    const isA2A = plan.actions.length >= 2 &&
      !!(rootDelegation && subDelegation && reDelegation)

    if (isA2A) {
      return executeA2A(plan, rootDelegation!.hash, subDelegation!.hash, reDelegation!.hash)
    }

    return executeSingle(plan)
  }

  async function executeA2A(
    plan: ActionPlan,
    rootDelegationHash: Hash,
    subDelegationHash: Hash,
    reDelegationHash: Hash,
  ): Promise<{ taskId: string; isA2A: boolean }> {
    const signedDelegations = delegations.filter(
      (d) => d.hash === rootDelegationHash ||
             d.hash === subDelegationHash ||
             d.hash === reDelegationHash,
    )

    const res = await fetch('/api/a2a/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: plan.intent,
        rootDelegationHash,
        subDelegationHash,
        reDelegationHash,
        signedDelegations,
        userAddress,
      }),
    })

    const data = (await res.json()) as
      | { success: true; taskId: string }
      | { success: false; error: string }

    if (!data.success) throw new Error(data.error)
    return { taskId: data.taskId, isA2A: true }
  }

  async function executeSingle(
    plan: ActionPlan,
  ): Promise<{ taskId: string; isA2A: boolean }> {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionPlan: serialisePlan(plan),
        signedDelegations: delegations,
        userAddress,
      }),
    })

    const data = (await res.json()) as
      | { success: true; taskId: string }
      | { success: false; error: string }

    if (!data.success) throw new Error(data.error)
    return { taskId: data.taskId, isA2A: false }
  }

  return {
    executeIntent,
    executePlan,
    isExecuting,
    error,
    clearError: () => setError(null),
  }
}
