import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { send7710Transaction } from '@/lib/oneshot/client'
import type { Hash } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { delegationHash?: Hash }

    if (!body.delegationHash) {
      return NextResponse.json(
        { success: false, error: 'Missing delegationHash' },
        { status: 400 },
      )
    }

    if (isDemoMode() || !process.env.ONESHOT_API_KEY) {
      return NextResponse.json({
        success: true,
        taskId: `demo-revoke-${Date.now()}`,
      })
    }

    const kernelAddress = process.env.OS_KERNEL_ADDRESS as Hash | undefined
    if (!kernelAddress) {
      return NextResponse.json(
        { success: false, error: 'OS_KERNEL_ADDRESS not configured' },
        { status: 500 },
      )
    }

    const { taskId } = await send7710Transaction({
      chainId: Number(process.env.ONESHOT_CHAIN_ID ?? 11155111),
      userOps: [
        {
          sender: kernelAddress,
          callData: body.delegationHash, // revokeOne(bytes32) — ABI encode in client
        },
      ],
      destinationUrl: process.env.ONESHOT_WEBHOOK_URL,
    })

    return NextResponse.json({ success: true, taskId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Revoke relay failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
