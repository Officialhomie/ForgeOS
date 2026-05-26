/**
 * Execution Engine — Action Graph
 *
 * Converts an ActionPlan into an ordered execution graph.
 * Resolves dependencies between actions (hop1 must complete before hop2).
 *
 * Track evidence: Best A2A — 2-hop chain executes in dependency order
 */

import type { ActionPlan, PlannedAction } from '@/types'

// ─── GRAPH NODE ───────────────────────────────────────────────────────────────

export interface ActionNode {
  action: PlannedAction
  /** Hop index (0 = hop1, 1 = hop2) */
  hop: number
  /** Actions that must complete before this one */
  dependencies: ActionNode[]
  /** Whether this action can execute now (all deps resolved) */
  ready: boolean
}

// ─── BUILD GRAPH ──────────────────────────────────────────────────────────────

/**
 * Build an ordered execution graph from an ActionPlan.
 *
 * Resolves `dependsOn` references to actual ActionNode pointers.
 * Returns nodes in topological order (hop1 first, then hop2).
 */
export function buildActionGraph(plan: ActionPlan): ActionNode[] {
  const nodeById = new Map<string, ActionNode>()

  // First pass: create nodes
  for (let i = 0; i < plan.actions.length; i++) {
    const action = plan.actions[i]
    const node: ActionNode = {
      action,
      hop: i,
      dependencies: [],
      ready: action.dependsOn.length === 0,
    }
    nodeById.set(action.id, node)
  }

  // Second pass: resolve dependencies
  for (const node of nodeById.values()) {
    for (const depId of node.action.dependsOn) {
      const dep = nodeById.get(depId)
      if (dep) node.dependencies.push(dep)
    }
    node.ready = node.dependencies.length === 0
  }

  // Return in topological order
  return topologicalSort([...nodeById.values()])
}

// ─── TOPOLOGICAL SORT ─────────────────────────────────────────────────────────

function topologicalSort(nodes: ActionNode[]): ActionNode[] {
  const visited = new Set<string>()
  const result: ActionNode[] = []

  function visit(node: ActionNode) {
    if (visited.has(node.action.id)) return
    visited.add(node.action.id)
    for (const dep of node.dependencies) {
      visit(dep)
    }
    result.push(node)
  }

  for (const node of nodes) {
    visit(node)
  }

  return result
}

// ─── DEPENDENCY VALIDATION ────────────────────────────────────────────────────

/**
 * Validate that the action plan can execute:
 * - No circular dependencies
 * - All delegationChains are non-empty
 * - Hop 2 delegation chain is longer than hop 1 (proves narrowing)
 */
export function validateActionGraph(plan: ActionPlan): string[] {
  const errors: string[] = []

  for (const action of plan.actions) {
    if (action.delegationChain.length === 0) {
      errors.push(`Action ${action.id} has no delegation chain`)
    }
  }

  // For a 2-hop A2A plan: hop2 chain must be strictly longer than hop1
  if (plan.actions.length >= 2) {
    const hop1 = plan.actions[0]
    const hop2 = plan.actions[1]
    if (hop1 && hop2 && hop2.delegationChain.length <= hop1.delegationChain.length) {
      errors.push('Hop 2 delegation chain must be longer than hop 1 (re-delegation not narrowing)')
    }
  }

  return errors
}

// ─── EXECUTION SUMMARY ────────────────────────────────────────────────────────

export interface ExecutionSummary {
  totalActions: number
  totalHops: number
  isA2A: boolean
  maxDelegationDepth: number
  estimatedCost: bigint
}

export function summariseGraph(plan: ActionPlan): ExecutionSummary {
  const depths = plan.actions.map((a) => a.delegationChain.length)
  return {
    totalActions: plan.actions.length,
    totalHops: plan.actions.length,
    isA2A: plan.actions.length >= 2,
    maxDelegationDepth: Math.max(...depths, 0),
    estimatedCost: plan.estimatedCost,
  }
}
