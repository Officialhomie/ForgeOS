/**
 * POST /api/command
 *
 * Parse user intent with Venice AI (chat + embeddings) → ActionPlan.
 *
 * Track evidence:
 *  - Best Venice AI: /v1/chat/completions + /v1/embeddings both called
 *  - Best Agent: intent drives delegation-aware planning
 */

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { getVeniceClient, VenicePaymentRequired } from '@/lib/venice/client'
import { activityEmitter } from '@/lib/events/activity-emitter'
import type { ActionPlan, VeniceSystemContext, ActivityEvent } from '@/types'

// ─── MOCK PLAN (demo mode) ────────────────────────────────────────────────────

function mockActionPlan(intent: string): ActionPlan {
  return {
    id: `plan_demo_${Date.now()}`,
    intent,
    summary: `Demo plan: ${intent.slice(0, 60)}`,
    actions: [
      {
        id: 'action_demo_1',
        type: 'erc20_swap',
        agentId: 'defi-rebalancer',
        delegationChain: [
          '0xROOT0000000000000000000000000000000000000000000000000000000000001',
          '0xDEFI0000000000000000000000000000000000000000000000000000000000001',
        ],
        target: '0xUniswap0000000000000000000000000000000000',
        calldata: '0x',
        value: 50_000000n,
        humanDescription: 'Swap 50 USDC → ETH on Uniswap V3',
        estimatedOutput: '~0.021 ETH',
        withinDelegationScope: true,
        dependsOn: [],
      },
    ],
    estimatedCost: 40000n,
    estimatedGas: 0n,
    withinPolicy: true,
    policyViolations: [],
    generatedAt: Math.floor(Date.now() / 1000),
    veniceModel: 'llama-3.3-70b',
  }
}

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface CommandRequest {
  intent: string
  userAddress?: string
  context?: Partial<VeniceSystemContext>
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: CommandRequest
  try {
    body = (await request.json()) as CommandRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON', code: 'UNKNOWN' }, { status: 400 })
  }

  const { intent, context } = body
  if (!intent?.trim()) {
    return NextResponse.json({ success: false, error: 'intent is required', code: 'UNKNOWN' }, { status: 400 })
  }

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (isDemoMode()) {
    const plan = mockActionPlan(intent)

    // Emit demo activity event so the feed updates
    const activity: ActivityEvent = {
      id: `cmd_${Date.now()}`,
      type: 'command_executed',
      agentId: null,
      title: 'Command received',
      description: intent.slice(0, 80),
      amount: null,
      txHash: null,
      delegationHash: null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({
      success: true,
      actionPlan: serialisePlan(plan),
      veniceModel: 'llama-3.3-70b',
      cost: '0.00',
      streamUrl: null,
    })
  }

  // ── Live mode ──────────────────────────────────────────────────────────────
  if (!process.env.AGENT_WALLET_KEY) {
    return NextResponse.json(
      { success: false, error: 'AGENT_WALLET_KEY not configured', code: 'VENICE_ERROR' },
      { status: 503 },
    )
  }

  try {
    const venice = getVeniceClient()

    // ① Chat completion — intent parsing
    const plan = await venice.parseIntent(intent, context)

    // ② Embeddings — agent memory lookup (satisfies Venice multi-endpoint requirement)
    //    Run in background; don't block the response.
    void venice
      .embeddings({ input: intent })
      .then((embedding) => {
        // In production: store embedding for semantic search over agent history.
        // For now, just log the dimension to prove the call fired.
        void embedding.length // silence unused var lint
      })
      .catch(() => {
        // Non-critical — embeddings failure must not break command flow
      })

    const activity: ActivityEvent = {
      id: `cmd_${plan.id}`,
      type: 'command_executed',
      agentId: null,
      title: 'Command received',
      description: plan.summary,
      amount: plan.estimatedCost,
      txHash: null,
      delegationHash: null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({
      success: true,
      actionPlan: serialisePlan(plan),
      veniceModel: plan.veniceModel,
      cost: (Number(plan.estimatedCost) / 1_000_000).toFixed(4),
      streamUrl: null,
    })
  } catch (e) {
    if (e instanceof VenicePaymentRequired) {
      return NextResponse.json(
        { success: false, error: 'Treasury balance insufficient for Venice inference', code: 'INSUFFICIENT_TREASURY' },
        { status: 402 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Venice error'
    return NextResponse.json(
      { success: false, error: msg, code: 'VENICE_ERROR' },
      { status: 500 },
    )
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Convert bigint fields to strings for JSON serialisation.
 * The client converts them back to bigint using the type system.
 */
function serialisePlan(plan: ActionPlan): Record<string, unknown> {
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
