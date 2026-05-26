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
import { parseA2AIntent, mockA2APlan } from './intent-parser'
import type { ActionPlan, Hash } from '@/types'

// ─── ORCHESTRATOR INPUT ───────────────────────────────────────────────────────

export interface OrchestratorInput {
  intent: string
  /** Root delegation hash (User → OSKernel) — must be signed */
  rootDelegationHash: Hash
  /** Sub-delegation hash (OSKernel → DeFiAgent) — created by createSubDelegation */
  subDelegationHash: Hash
  /** Re-delegation hash (DeFiAgent → PaymentAgent) — created by createReDelegation */
  reDelegationHash: Hash
  /** If true, skip Venice and return mock plan */
  demoMode?: boolean
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
  const { intent, rootDelegationHash, subDelegationHash, reDelegationHash, demoMode } = input

  // Step 1: Route to agent chain
  const route = routeIntent(intent)

  // Step 2: Build A2A ActionPlan
  let plan: ActionPlan

  if (demoMode) {
    plan = mockA2APlan(intent, rootDelegationHash, subDelegationHash, reDelegationHash)
  } else {
    plan = await parseA2AIntent(
      intent,
      rootDelegationHash,
      subDelegationHash,
      reDelegationHash,
    )
  }

  return {
    plan,
    primaryAgent: route.primaryAgent,
    secondaryAgent: route.secondaryAgent,
    isA2A: route.isA2A,
  }
}
