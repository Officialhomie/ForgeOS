/**
 * ForgeOS Orchestrator — Entry Point
 *
 * Receives a user command, routes to agents, builds A2A ActionPlan.
 *
 * Flow:
 *  1. routeIntent() selects DeFiAgent + PaymentAgent
 *  2. parseA2AIntent() uses Venice to build a 2-hop plan
 *  3. Returns ActionPlan with delegation chains populated per hop
 *
 * Track evidence: Best A2A Coordination, Best Venice AI, Best Agent
 */

import { routeIntent } from './agent-router'
import { parseA2AIntent } from './intent-parser'
import type { ActionPlan, Hash } from '@/types'

// ─── ORCHESTRATOR INPUT ───────────────────────────────────────────────────────

export interface OrchestratorInput {
  intent: string
  rootDelegationHash: Hash
  subDelegationHash: Hash
  reDelegationHash: Hash
  sessionId?: string
}

// ─── ORCHESTRATOR RESULT ──────────────────────────────────────────────────────

export interface OrchestratorResult {
  plan: ActionPlan
  primaryAgent: string
  secondaryAgent: string | null
  isA2A: boolean
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Execute the A2A orchestration flow.
 *
 * 1. Routes the intent to the correct agent chain (P8.3)
 * 2. Calls Venice to build the 2-hop ActionPlan (P8.3)
 * 3. Populates delegation chains for each hop (P8.1 + P8.2)
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { intent, rootDelegationHash, subDelegationHash, reDelegationHash } = input

  const route = routeIntent(intent)

  const sessionId = input.sessionId ?? `a2a_${Date.now()}`
  const plan = await parseA2AIntent(
    intent,
    rootDelegationHash,
    subDelegationHash,
    reDelegationHash,
    sessionId,
  )

  return {
    plan,
    primaryAgent: route.primaryAgent,
    secondaryAgent: route.secondaryAgent,
    isA2A: route.isA2A,
  }
}
