/**
 * POST /api/relay/revoke-all — OSKernel.revokeAll() via 1Shot.
 */

import { NextResponse } from 'next/server'
import { encodeFunctionData } from 'viem'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { registerKillSwitchTask } from '@/lib/kill-switch/registry'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import type { ActivityEvent, Delegation } from '@/types'

const OS_KERNEL_ABI = [
  {
    name: 'revokeAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
] as const

export async function POST(request: Request) {
  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json({ success: false, error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
  }

  let delegations: Delegation[] = []
  try {
    const body = (await request.json()) as { delegations?: Delegation[] }
    delegations = body.delegations ?? []
  } catch {
    // empty body ok
  }

  const kernelAddress = CONTRACTS.osKernel

  try {
    const callData = encodeFunctionData({
      abi: OS_KERNEL_ABI,
      functionName: 'revokeAll',
    })

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps: [
        {
          sender: kernelAddress,
          callData,
          target: kernelAddress,
          value: '0',
          nonce: 0,
        },
      ],
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)
    if (delegations.length > 0) {
      registerKillSwitchTask(taskId, delegations)
    }

    const pendingEvent: ActivityEvent = {
      id: `kill_switch_${taskId}`,
      type: 'os_revoked',
      agentId: null,
      title: 'Kill switch activated',
      description: `OSKernel.revokeAll() submitted`,
      amount: null,
      txHash: null,
      delegationHash: null,
      taskId,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    }
    activityEmitter.emitActivity(pendingEvent)

    return NextResponse.json({ success: true, taskId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'revokeAll relay error'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
