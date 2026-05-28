/**
 * POST /api/execute
 *
 * Submit an approved ActionPlan as UserOps via 1Shot relay.
 */

import { NextResponse } from 'next/server'
import { send7710Transaction } from '@/lib/oneshot/client'
import {
  buildAndValidateUserOps,
  delegationProofErrorResponse,
} from '@/lib/delegation/proof-validation'
import { createFlowTimer } from '@/lib/telemetry/flow-timer'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { APP_URL, ONESHOT } from '@/lib/constants'
import type { ActionPlan, Delegation, ChainId, ActivityEvent } from '@/types'

interface ExecuteRequest {
  actionPlan: ActionPlan & {
    estimatedCost: string
    estimatedGas: string
    actions: Array<Omit<ActionPlan['actions'][number], 'value'> & { value: string }>
  }
  signedDelegations?: Delegation[]
  userAddress?: string
  chainId?: ChainId
}

export async function POST(request: Request) {
  let body: ExecuteRequest
  try {
    body = (await request.json()) as ExecuteRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON', code: 'UNKNOWN' }, { status: 400 })
  }

  const { actionPlan, signedDelegations = [], chainId = ONESHOT.CHAIN_ID } = body

  if (!actionPlan?.actions?.length) {
    return NextResponse.json(
      { success: false, error: 'actionPlan.actions is empty', code: 'UNKNOWN' },
      { status: 400 },
    )
  }

  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured', code: 'ONESHOT_ERROR' },
      { status: 503 },
    )
  }

  const timer = createFlowTimer('execute')

  try {
    timer.checkpoint('build_start')
    const normalizedActions = actionPlan.actions.map((a) => ({
      ...a,
      value: BigInt(a.value),
    }))
    const userOps = buildAndValidateUserOps({
      actions: normalizedActions,
      signedDelegations,
      senderAddress: body.userAddress,
    })
    timer.checkpoint('build_end')

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    timer.checkpoint('oneshot_start')
    const { taskId } = await send7710Transaction({
      chainId,
      userOps,
      destinationUrl: webhookUrl,
    })
    timer.checkpoint('oneshot_end')

    taskStore.create(taskId)

    const activity: ActivityEvent = {
      id: `exec_${taskId}`,
      type: 'agent_run_confirmed',
      agentId: actionPlan.actions[0]?.agentId ?? null,
      title: 'Transaction submitted',
      description: `Task ${taskId} — waiting for 1Shot confirmation`,
      amount: BigInt(actionPlan.estimatedCost),
      txHash: null,
      delegationHash: actionPlan.actions[0]?.delegationChain?.[0] ?? null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({
      success: true,
      taskId,
      userOpHashes: userOps.map((_, i) => `0x${i}` as `0x${string}`),
      estimatedConfirmation: 15,
      timing: timer.end(),
    })
  } catch (e) {
    const proofErr = delegationProofErrorResponse(e)
    if (proofErr) {
      return NextResponse.json(proofErr, { status: 422 })
    }
    const msg = e instanceof Error ? e.message : '1Shot relay error'
    return NextResponse.json(
      { success: false, error: msg, code: 'ONESHOT_ERROR' },
      { status: 500 },
    )
  }
}
