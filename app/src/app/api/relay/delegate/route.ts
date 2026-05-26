import { NextResponse } from 'next/server'
import { ONESHOT } from '@/lib/constants'
import { isDemoMode } from '@/lib/demo'
import { send7710Transaction } from '@/lib/oneshot/client'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chainId?: number
      delegationHash?: string
    }

    if (isDemoMode() || !process.env.ONESHOT_API_KEY) {
      return NextResponse.json({
        taskId: `demo-delegate-${Date.now()}`,
        delegationHash: body.delegationHash,
        status: 'confirmed',
      })
    }

    const chainId = body.chainId ?? ONESHOT.CHAIN_ID
    const { taskId } = await send7710Transaction({
      chainId,
      userOps: [{ delegationHash: body.delegationHash }],
      destinationUrl: process.env.ONESHOT_WEBHOOK_URL,
    })

    return NextResponse.json({ taskId, status: 'submitted' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Relay delegate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
