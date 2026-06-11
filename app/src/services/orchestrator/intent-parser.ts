/**
 * Orchestrator — Intent Parser
 *
 * Uses Venice chat to parse a user intent into an A2A-aware ActionPlan.
 * Specifically builds the 2-hop delegation chain:
 *   Orchestrator → DeFiAgent (hop 1) → PaymentAgent (hop 2)
 *
 * Track evidence: Best Venice AI (chat endpoint), Best A2A
 */

import { getVeniceClient } from '@/lib/venice/client'
import type {
  ActionPlan,
  Address,
  AgentId,
  PlannedAction,
  ActionType,
  Hash,
} from '@/types'

// ─── A2A SYSTEM PROMPT ────────────────────────────────────────────────────────

const A2A_SYSTEM_PROMPT = `You are ForgeOS Orchestrator. You parse user intents into A2A (agent-to-agent) action plans.

The A2A chain is always:
  Hop 1: DeFiAgent (defi-rebalancer) — decision + calculation
  Hop 2: PaymentAgent (payment-executor) — USDC execution

RULES:
- Hop 1 uses delegationChain: [rootHash, defiHash]
- Hop 2 uses delegationChain: [rootHash, defiHash, reDelegate Hash]
- ERC20 amounts are in USDC with 6 decimals (1 USDC = 1_000_000)
- Never allow amounts exceeding hop limits (hop1: 500 USDC, hop2: 100 USDC)
- The "target" field MUST be a real checksummed contract address taken from the
  context provided to you (e.g. a token or recipient address in the user intent).
  NEVER output the zero address, an example address, or the literal template
  token below. If you cannot determine a real target address, OMIT that action.

Respond ONLY with valid JSON:
{
  "summary": "<one sentence>",
  "actions": [
    {
      "id": "hop1",
      "type": "erc20_swap",
      "agentId": "defi-rebalancer",
      "target": "<TARGET_CONTRACT_ADDRESS>",
      "calldata": "0x",
      "value": 0,
      "humanDescription": "<what DeFiAgent does>",
      "estimatedOutput": "<expected result>",
      "withinDelegationScope": true,
      "dependsOn": []
    },
    {
      "id": "hop2",
      "type": "erc20_transfer",
      "agentId": "payment-executor",
      "target": "<TARGET_CONTRACT_ADDRESS>",
      "calldata": "0x",
      "value": 50000000,
      "humanDescription": "<what PaymentAgent executes>",
      "estimatedOutput": "<expected result>",
      "withinDelegationScope": true,
      "dependsOn": ["hop1"]
    }
  ],
  "estimatedCost": 40000,
  "withinPolicy": true,
  "policyViolations": []
}`

// ─── PARSED SHAPE ─────────────────────────────────────────────────────────────

interface RawA2AAction {
  id?: string
  type?: string
  agentId?: string
  target?: string
  calldata?: string
  value?: number
  humanDescription?: string
  estimatedOutput?: string
  withinDelegationScope?: boolean
  dependsOn?: string[]
}

interface RawA2APlan {
  summary?: string
  actions?: RawA2AAction[]
  estimatedCost?: number
  withinPolicy?: boolean
  policyViolations?: string[]
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Parse a user intent into an A2A 2-hop ActionPlan.
 *
 * @param intent     Natural language command from the user
 * @param rootHash   Signed root delegation hash (User → OSKernel)
 * @param defiHash   Signed hop-1 delegation hash (OSKernel → DeFiAgent)
 * @param redelHash  Signed hop-2 re-delegation hash (DeFiAgent → PaymentAgent)
 */
export async function parseA2AIntent(
  intent: string,
  rootHash: Hash,
  defiHash: Hash,
  redelHash: Hash,
  sessionId?: string,
  primaryAgent: string = 'defi-rebalancer',
  secondaryAgent: string | null = 'payment-executor',
): Promise<ActionPlan> {
  const venice = await getVeniceClient()

  const sessionNote = sessionId
    ? `\nCollaboration session: ${sessionId}. Primary agent: ${primaryAgent}. Secondary agent: ${secondaryAgent ?? 'none'}. Hop 2 must reference hop 1 budget/outputs.`
    : ''

  const { completion } = await venice.chat({
    messages: [
      { role: 'system', content: A2A_SYSTEM_PROMPT + sessionNote },
      { role: 'user', content: intent },
    ],
  })

  const content = completion.choices[0]?.message.content ?? '{}'
  return buildA2APlan(
    content,
    intent,
    completion.model,
    rootHash,
    defiHash,
    redelHash,
    primaryAgent,
    secondaryAgent,
  )
}

// ─── PARSER ───────────────────────────────────────────────────────────────────

function buildA2APlan(
  content: string,
  intent: string,
  model: string,
  rootHash: Hash,
  defiHash: Hash,
  redelHash: Hash,
  primaryAgent: string,
  secondaryAgent: string | null,
): ActionPlan {
  const id = `plan_a2a_${Math.random().toString(36).slice(2, 10)}`

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0] : '{}'

  let parsed: RawA2APlan
  try {
    parsed = JSON.parse(raw) as RawA2APlan
  } catch {
    parsed = {}
  }

  const rawActions = parsed.actions ?? []
  const expectedPrimaryAgent = primaryAgent
  const expectedSecondaryAgent = secondaryAgent ?? 'payment-executor'

  const actions: PlannedAction[] = rawActions.map((a, i) => {
    // Hop 1 (DeFiAgent) uses root + defi delegation chain
    // Hop 2 (PaymentAgent) uses root + defi + redel chain
    const isHop2 =
      i === 1 || (a.agentId ?? '').includes('payment') || (a.agentId ?? '') === expectedSecondaryAgent
    const delegationChain: Hash[] = isHop2
      ? [rootHash, defiHash, redelHash]
      : [rootHash, defiHash]

    return {
      id: a.id ?? `action_${i}`,
      type: (a.type as ActionType) ?? (isHop2 ? 'erc20_transfer' : 'erc20_swap'),
      agentId:
        (a.agentId as AgentId) ??
        (isHop2 ? (expectedSecondaryAgent as AgentId) : (expectedPrimaryAgent as AgentId)),
      delegationChain,
      // No zero-address fallback: a missing target stays visibly invalid ('0x')
      // and is rejected by assertValidActionTarget before any UserOp is built.
      target: (a.target ?? '0x') as Address,
      calldata: (a.calldata as `0x${string}`) ?? '0x',
      value: BigInt(a.value ?? 0),
      humanDescription: a.humanDescription ?? '',
      estimatedOutput: a.estimatedOutput ?? '',
      withinDelegationScope: a.withinDelegationScope ?? true,
      dependsOn: a.dependsOn ?? [],
    }
  })

  // Guarantee at least 2 hops in the plan (fallback if Venice returned 1 action)
  if (actions.length === 1) {
    const hop2Fallback: PlannedAction = {
      id: 'hop2_fallback',
      type: 'erc20_transfer',
      agentId: expectedSecondaryAgent as AgentId,
      delegationChain: [rootHash, defiHash, redelHash],
      // Deliberately invalid: the synthetic hop-2 has no real target, so it must
      // fail target validation rather than be submitted to the zero address.
      target: '0x' as Address,
      calldata: '0x',
      value: 0n,
      humanDescription: 'PaymentAgent executes final USDC transfer',
      estimatedOutput: 'Transfer confirmed',
      withinDelegationScope: true,
      dependsOn: [actions[0].id],
    }
    actions.push(hop2Fallback)
  }

  return {
    id,
    intent,
    summary: parsed.summary ?? intent,
    actions,
    estimatedCost: BigInt(parsed.estimatedCost ?? 40000),
    estimatedGas: 0n,
    withinPolicy: parsed.withinPolicy ?? true,
    policyViolations: parsed.policyViolations ?? [],
    generatedAt: Math.floor(Date.now() / 1000),
    veniceModel: model,
  }
}
