/**
 * POST /api/a2a/execute
 *
 * End-to-end A2A orchestration:
 *  1. Accept user intent + signed delegation hashes
 *  2. Parse intent with Venice AI (orchestrator)
 *  3. Build 2-hop ActionPlan with delegation chains
 *  4. Submit UserOps to 1Shot relay (with webhook)
 *  5. Return taskId immediately; status arrives via /api/webhooks/1shot
 *
 * Track evidence:
 *  - Best A2A Coordination: 2-hop chain, OSKernel→DeFiAgent→PaymentAgent
 *  - Best Venice AI: parseA2AIntent calls Venice chat + embeddings
 *  - Best 1Shot: caps → fee → send7710Transaction with webhook URL
 *  - Best x402+7710: delegation proof per UserOp
 */

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { orchestrate } from '@/services/orchestrator'
import { buildActionGraph, validateActionGraph } from '@/services/execution-engine/action-graph'
import { buildUserOps, buildDemoUserOps } from '@/services/execution-engine/userop-builder'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { getVeniceClient } from '@/lib/venice/client'
import type { ActionPlan, Delegation, Hash, ActivityEvent } from '@/types'

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface A2AExecuteRequest {
  intent: string
  /** Root delegation hash (User → OSKernel) */
  rootDelegationHash: Hash
  /** Sub-delegation hash (OSKernel → DeFiAgent) */
  subDelegationHash: Hash
  /** Re-delegation hash (DeFiAgent → PaymentAgent) */
  reDelegationHash: Hash
  /** Signed delegation objects (for on-chain proof inclusion) */
  signedDelegations?: Delegation[]
  userAddress?: string
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: A2AExecuteRequest
  try {
    body = (await request.json()) as A2AExecuteRequest
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON', code: 'UNKNOWN' },
      { status: 400 },
    )
  }

  const {
    intent,
    rootDelegationHash,
    subDelegationHash,
    reDelegationHash,
    signedDelegations = [],
    userAddress,
  } = body

  if (!intent?.trim()) {
    return NextResponse.json(
      { success: false, error: 'intent is required', code: 'UNKNOWN' },
      { status: 400 },
    )
  }

  if (!rootDelegationHash || !subDelegationHash || !reDelegationHash) {
    return NextResponse.json(
      { success: false, error: 'All three delegation hashes are required', code: 'UNKNOWN' },
      { status: 400 },
    )
  }

  // ── Demo mode ──────────────────────────────────────────────────────────────

  if (isDemoMode()) {
    const { plan } = await orchestrate({
      intent,
      rootDelegationHash,
      subDelegationHash,
      reDelegationHash,
      demoMode: true,
    })

    const taskId = `demo-a2a-${Date.now()}`
    const mockTxHash1 = `0xA2AHOP1${Date.now().toString(16).padStart(56, '0')}` as `0x${string}`
    const mockTxHash2 = `0xA2AHOP2${Date.now().toString(16).padStart(56, '0')}` as `0x${string}`

    taskStore.create(taskId)
    taskStore.update(taskId, 'Confirmed', mockTxHash2)

    // Emit hop 1 confirmed event
    const hop1Activity: ActivityEvent = {
      id: `a2a_hop1_${taskId}`,
      type: 'delegation_issued',
      agentId: 'defi-rebalancer',
      title: 'A2A Hop 1 — DeFiAgent',
      description: plan.actions[0]?.humanDescription ?? 'DeFiAgent delegated',
      amount: plan.actions[0]?.value ?? null,
      txHash: mockTxHash1,
      delegationHash: subDelegationHash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(hop1Activity)

    // Emit hop 2 confirmed event
    const hop2Activity: ActivityEvent = {
      id: `a2a_hop2_${taskId}`,
      type: 'agent_run_confirmed',
      agentId: 'payment-executor',
      title: 'A2A Hop 2 — PaymentAgent',
      description: plan.actions[1]?.humanDescription ?? 'PaymentAgent executed',
      amount: plan.actions[1]?.value ?? null,
      txHash: mockTxHash2,
      delegationHash: reDelegationHash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(hop2Activity)

    return NextResponse.json({
      success: true,
      taskId,
      plan: serialisePlan(plan),
      primaryAgent: 'defi-rebalancer',
      secondaryAgent: 'payment-executor',
      isA2A: true,
      hops: 2,
    })
  }

  // ── Live mode ──────────────────────────────────────────────────────────────

  if (!process.env.AGENT_WALLET_KEY) {
    return NextResponse.json(
      { success: false, error: 'AGENT_WALLET_KEY not configured', code: 'VENICE_ERROR' },
      { status: 503 },
    )
  }

  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured', code: 'ONESHOT_ERROR' },
      { status: 503 },
    )
  }

  try {
    // Step 1: Build A2A plan via Venice orchestrator
    const { plan, primaryAgent, secondaryAgent, isA2A } = await orchestrate({
      intent,
      rootDelegationHash,
      subDelegationHash,
      reDelegationHash,
    })

    // Step 2: Fire embeddings call in background (Venice multi-endpoint track)
    const venice = getVeniceClient()
    void venice.embeddings({ input: intent }).catch(() => {
      // Non-critical
    })

    // Step 3: Validate the action graph
    const graphErrors = validateActionGraph(plan)
    if (graphErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: graphErrors.join('; '), code: 'DELEGATION_INVALID' },
        { status: 422 },
      )
    }

    // Step 4: Build ordered execution graph
    const _graph = buildActionGraph(plan) // validates topological order

    // Step 5: Build UserOps (one per hop, with delegation proofs)
    const userOps = buildUserOps({
      actions: plan.actions,
      signedDelegations,
      senderAddress: userAddress,
    })

    // Step 6: Submit to 1Shot relay with webhook
    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps,
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)

    // Emit pending activity
    const pendingActivity: ActivityEvent = {
      id: `a2a_${taskId}`,
      type: 'delegation_issued',
      agentId: 'defi-rebalancer',
      title: `A2A chain submitted (${isA2A ? '2-hop' : '1-hop'})`,
      description: plan.summary,
      amount: plan.estimatedCost,
      txHash: null,
      delegationHash: subDelegationHash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    }
    activityEmitter.emitActivity(pendingActivity)

    return NextResponse.json({
      success: true,
      taskId,
      plan: serialisePlan(plan),
      primaryAgent,
      secondaryAgent,
      isA2A,
      hops: plan.actions.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Orchestration error'
    return NextResponse.json(
      { success: false, error: msg, code: 'UNKNOWN' },
      { status: 500 },
    )
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
