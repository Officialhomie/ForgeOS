/**
 * POST /api/relay/redelegate
 *
 * Submits OSKernel.redelegate(parent) via 1Shot for on-chain sub-delegation chain.
 */

import { NextResponse } from 'next/server'
import { send7710Transaction } from '@/lib/oneshot/client'
import { encodeKernelRedelegateCalldata } from '@/lib/delegation/encode-kernel'
import { taskStore } from '@/lib/oneshot/task-store'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import type { Delegation, Hash } from '@/types'

export async function POST(request: Request) {
  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json({ success: false, error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
  }

  let body: { parentHash: Hash; delegation: Delegation }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { parentHash, delegation } = body
  if (!parentHash || !delegation?.hash) {
    return NextResponse.json(
      { success: false, error: 'parentHash and delegation required' },
      { status: 400 },
    )
  }

  try {
    const kernelAddress = CONTRACTS.osKernel
    const callData = encodeKernelRedelegateCalldata(delegation, parentHash)
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
          delegationHash: delegation.hash,
        },
      ],
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)

    return NextResponse.json({
      success: true,
      taskId,
      delegationHash: delegation.hash,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'redelegate relay failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
