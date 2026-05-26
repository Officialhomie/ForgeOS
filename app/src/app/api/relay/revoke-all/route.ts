/**
 * POST /api/relay/revoke-all
 *
 * Encodes OSKernel.revokeAll() and submits via 1Shot relay.
 * Returns taskId immediately; confirmation arrives via webhook.
 *
 * Track evidence:
 *  - Best Agent: atomic kill switch, safety UX
 *  - Best 1Shot: webhook callback (not polling)
 */

import { NextResponse } from 'next/server'
import { encodeFunctionData } from 'viem'
import { isDemoMode } from '@/lib/demo'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { APP_URL, ONESHOT } from '@/lib/constants'
import type { ActivityEvent, Hash } from '@/types'

// Minimal ABI — only revokeAll() needed
const OS_KERNEL_ABI = [
  {
    name: 'revokeAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
] as const

export async function POST() {
  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (isDemoMode() || !process.env.ONESHOT_API_KEY) {
    const taskId = `demo-revoke-all-${Date.now()}`
    const mockTxHash = `0xKILL${Date.now().toString(16).padStart(60, '0')}` as Hash

    taskStore.create(taskId)
    taskStore.update(taskId, 'Confirmed', mockTxHash)

    const event: ActivityEvent = {
      id: `kill_switch_${taskId}`,
      type: 'os_revoked',
      agentId: null,
      title: 'All delegations revoked (demo)',
      description: 'OSKernel.revokeAll() — AllDelegationsRevoked event emitted',
      amount: null,
      txHash: mockTxHash,
      delegationHash: null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(event)

    return NextResponse.json({ success: true, taskId })
  }

  // ── Live mode ──────────────────────────────────────────────────────────────
  const kernelAddress = process.env.OS_KERNEL_ADDRESS as `0x${string}` | undefined
  if (!kernelAddress) {
    return NextResponse.json(
      { success: false, error: 'OS_KERNEL_ADDRESS not configured' },
      { status: 503 },
    )
  }

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

    const pendingEvent: ActivityEvent = {
      id: `kill_switch_${taskId}`,
      type: 'os_revoked',
      agentId: null,
      title: 'Kill switch activated',
      description: `OSKernel.revokeAll() submitted — taskId: ${taskId}`,
      amount: null,
      txHash: null,
      delegationHash: null,
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
