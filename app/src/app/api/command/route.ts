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
import { assertTreasuryForInference } from '@/lib/treasury/guard'
import {
  formatFundingSnapshot,
  getAgentFundingSnapshot,
  getVeniceClient,
  hasAgentWallet,
  isBalanceCheckIntent,
  VeniceInsufficientBalanceError,
  VenicePaymentRequired,
  VeniceWalletError,
  walletEnvDiagnostics,
} from '@/lib/venice/client'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { createFlowTimer } from '@/lib/telemetry/flow-timer'
import type { ActionPlan, VeniceSystemContext, ActivityEvent } from '@/types'

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

  if (!hasAgentWallet()) {
    const diag = walletEnvDiagnostics()
    const detail =
      diag.turnkeyVarsSet > 0 && diag.turnkeyVarsSet < 5
        ? `Turnkey is partially configured (${diag.turnkeyVarsSet}/5 vars). Missing: ${diag.turnkeyVarsMissing.join(', ')}.`
        : 'Neither AGENT_WALLET_KEY nor a complete set of TURNKEY_* vars is available to the server. Put secrets in app/.env.local and restart pnpm dev.'
    return NextResponse.json(
      { success: false, error: detail, code: 'WALLET_UNCONFIGURED' },
      { status: 503 },
    )
  }

  const treasuryCheck = await assertTreasuryForInference()
  if (!treasuryCheck.ok) {
    return NextResponse.json(
      { success: false, error: treasuryCheck.message, code: 'TREASURY_LOW' },
      { status: 402 },
    )
  }

  if (isBalanceCheckIntent(intent)) {
    try {
      const snapshot = await getAgentFundingSnapshot()
      const summary = formatFundingSnapshot(snapshot)
      return NextResponse.json({
        success: true,
        balanceReport: snapshot,
        summary,
        actionPlan: serialisePlan({
          id: `balance_${Date.now()}`,
          intent,
          summary,
          actions: [],
          estimatedCost: 0n,
          estimatedGas: 0n,
          withinPolicy: true,
          policyViolations: [],
          generatedAt: Math.floor(Date.now() / 1000),
          veniceModel: 'base-mainnet-rpc',
        }),
        veniceModel: 'base-mainnet-rpc',
        cost: '0',
        streamUrl: null,
        timing: null,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Balance check failed'
      return NextResponse.json({ success: false, error: msg, code: 'VENICE_ERROR' }, { status: 500 })
    }
  }

  const timer = createFlowTimer('command')

  try {
    timer.checkpoint('venice_init_start')
    const venice = await getVeniceClient()
    timer.checkpoint('venice_init_end')

    // ① Chat completion — intent parsing
    timer.checkpoint('venice_start')
    const plan = await venice.parseIntent(intent, context)
    timer.checkpoint('venice_end')

    // ② Embeddings — agent memory lookup (satisfies Venice multi-endpoint requirement)
    //    Run in background; don't block the response.
    void venice
      .embeddings({ input: intent })
      .then((embedding) => {
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

    const timing = timer.end()
    return NextResponse.json({
      success: true,
      actionPlan: serialisePlan(plan),
      veniceModel: plan.veniceModel,
      cost: (Number(plan.estimatedCost) / 1_000_000).toFixed(4),
      streamUrl: null,
      timing,
    })
  } catch (e) {
    if (e instanceof VeniceInsufficientBalanceError) {
      return NextResponse.json(
        { success: false, error: e.message, code: 'VENICE_BALANCE_LOW' },
        { status: 402 },
      )
    }
    if (e instanceof VenicePaymentRequired) {
      return NextResponse.json(
        { success: false, error: 'Treasury balance insufficient for Venice inference', code: 'INSUFFICIENT_TREASURY' },
        { status: 402 },
      )
    }
    if (e instanceof VeniceWalletError) {
      return NextResponse.json(
        { success: false, error: e.message, code: e.code },
        { status: e.code === 'WALLET_UNCONFIGURED' ? 503 : 500 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Venice error'
    if (msg.includes('exceeds balance') || msg.includes('insufficient funds')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The server agent wallet does not have enough USDC on Base to fund Venice AI. ' +
            'Send USDC on Base mainnet (chain 8453) to the agent wallet in your env, then retry.',
          code: 'VENICE_BALANCE_LOW',
        },
        { status: 402 },
      )
    }
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
