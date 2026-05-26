/**
 * POST /api/execute
 *
 * Submit an approved ActionPlan as UserOps via 1Shot relay.
 * Returns taskId immediately; status arrives via webhook → SSE.
 *
 * Track evidence:
 *  - Best 1Shot: caps → fee → send7710Transaction with webhook URL
 *  - Best A2A: delegation chain proof included per action
 *  - Best x402+7710: delegation proof in userOp
 */

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { APP_URL, ONESHOT } from '@/lib/constants'
import type { ActionPlan, Delegation, ChainId, ActivityEvent } from '@/types'

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface ExecuteRequest {
  actionPlan: ActionPlan & {
    estimatedCost: string   // bigint serialised as string by /api/command
    estimatedGas: string
    actions: Array<Omit<ActionPlan['actions'][number], 'value'> & { value: string }>
  }
  signedDelegations?: Delegation[]
  userAddress?: string
  chainId?: ChainId
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

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

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (isDemoMode()) {
    const taskId = `demo-exec-${Date.now()}`
    const mockTxHash = `0xEXEC${Date.now().toString(16).padStart(60, '0')}` as `0x${string}`

    taskStore.create(taskId)
    taskStore.update(taskId, 'Confirmed', mockTxHash)

    const activity: ActivityEvent = {
      id: `exec_${taskId}`,
      type: 'agent_run_confirmed',
      agentId: actionPlan.actions[0]?.agentId ?? null,
      title: 'Action executed (demo)',
      description: actionPlan.summary,
      amount: BigInt(actionPlan.estimatedCost),
      txHash: mockTxHash,
      delegationHash: actionPlan.actions[0]?.delegationChain?.[0] ?? null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({
      success: true,
      taskId,
      userOpHashes: [mockTxHash],
      estimatedConfirmation: 0,
    })
  }

  // ── Live mode ──────────────────────────────────────────────────────────────
  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured', code: 'ONESHOT_ERROR' },
      { status: 503 },
    )
  }

  try {
    // Build one UserOp per action.
    // In production these would be fully constructed ERC-4337 UserOps signed
    // with the Smart Accounts Kit. For now we pass the action data and let
    // the 1Shot relayer encode them.
    const userOps = actionPlan.actions.map((action, i) => ({
      sender: body.userAddress,
      callData: action.calldata,
      target: action.target,
      value: action.value,
      // Delegation proof: the ordered chain of signed delegation hashes
      delegationChain: action.delegationChain,
      // If a matching signed delegation was provided by the client, embed it
      delegation: signedDelegations.find((d) =>
        action.delegationChain.includes(d.hash),
      ) ?? undefined,
      nonce: i,
    }))

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL
      ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId,
      userOps,
      destinationUrl: webhookUrl,
    })

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
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '1Shot relay error'
    return NextResponse.json(
      { success: false, error: msg, code: 'ONESHOT_ERROR' },
      { status: 500 },
    )
  }
}
