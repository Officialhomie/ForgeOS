import { NextResponse } from 'next/server'
import { ONESHOT } from '@/lib/constants'
import { send7710Transaction } from '@/lib/oneshot/client'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chainId?: number
      smartAccountAddress?: string
    }
    if (!process.env.ONESHOT_API_KEY) {
      return NextResponse.json({ error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
    }

    const chainId = body.chainId ?? ONESHOT.CHAIN_ID
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
