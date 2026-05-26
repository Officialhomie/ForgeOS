import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { send7710Transaction } from '@/lib/oneshot/client'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chainId?: number
      smartAccountAddress?: string
    }

    if (isDemoMode() || !process.env.ONESHOT_API_KEY) {
      return NextResponse.json({
        taskId: `demo-deploy-${Date.now()}`,
        txHash:
          '0xDEPLOY000000000000000000000000000000000000000000000000000000001',
        status: 'confirmed',
        smartAccountAddress: body.smartAccountAddress,
      })
    }

    const chainId = body.chainId ?? 11155111
    const { taskId } = await send7710Transaction({
      chainId,
      userOps: [{ sender: body.smartAccountAddress }],
      destinationUrl: process.env.ONESHOT_WEBHOOK_URL,
    })

    return NextResponse.json({ taskId, status: 'submitted' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Relay deploy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
