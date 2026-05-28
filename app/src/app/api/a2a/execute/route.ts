/**
 * POST /api/a2a/execute — Venice orchestration + validated UserOps + 1Shot.
 */

import { NextResponse } from 'next/server'
import { orchestrate } from '@/services/orchestrator'
import { buildActionGraph, validateActionGraph } from '@/services/execution-engine/action-graph'
import {
  buildAndValidateUserOps,
  delegationProofErrorResponse,
} from '@/lib/delegation/proof-validation'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { createFlowTimer } from '@/lib/telemetry/flow-timer'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { getVeniceClient, hasAgentWallet } from '@/lib/venice/client'
import type { ActionPlan, Delegation, Hash, ActivityEvent } from '@/types'

interface A2AExecuteRequest {
  intent: string
  rootDelegationHash: Hash
  subDelegationHash: Hash
  reDelegationHash: Hash
  signedDelegations?: Delegation[]
  userAddress?: string
}

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

  if (!hasAgentWallet()) {
    return NextResponse.json(
      { success: false, error: 'Agent wallet not configured', code: 'VENICE_ERROR' },
      { status: 503 },
    )
  }

  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured', code: 'ONESHOT_ERROR' },
      { status: 503 },
    )
  }

  const timer = createFlowTimer('a2a_execute')

  try {
    timer.checkpoint('venice_start')
    const { plan, primaryAgent, secondaryAgent, isA2A } = await orchestrate({
      intent,
      rootDelegationHash,
      subDelegationHash,
      reDelegationHash,
    })
    timer.checkpoint('venice_end')

    void getVeniceClient().then((v) => v.embeddings({ input: intent })).catch(() => {})

    const graphErrors = validateActionGraph(plan)
    if (graphErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: graphErrors.join('; '), code: 'DELEGATION_INVALID' },
        { status: 422 },
      )
    }

    buildActionGraph(plan)

    timer.checkpoint('build_start')
    const userOps = buildAndValidateUserOps({
      actions: plan.actions,
      signedDelegations,
      senderAddress: userAddress,
    })
    timer.checkpoint('build_end')

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    timer.checkpoint('oneshot_start')
    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps,
      destinationUrl: webhookUrl,
    })
    timer.checkpoint('oneshot_end')

    taskStore.create(taskId)

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
      timing: timer.end(),
    })
  } catch (e) {
    const proofErr = delegationProofErrorResponse(e)
    if (proofErr) {
      return NextResponse.json(proofErr, { status: 422 })
    }
    const msg = e instanceof Error ? e.message : 'Orchestration error'
    return NextResponse.json(
      { success: false, error: msg, code: 'UNKNOWN' },
      { status: 500 },
    )
  }
}

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
