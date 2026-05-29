import { NextResponse } from 'next/server'
import { ONESHOT } from '@/lib/constants'
import { send7710Transaction } from '@/lib/oneshot/client'
import type { Delegation } from '@/types'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chainId?: number
      delegationHash?: string
      signedDelegation?: Delegation
    }

    if (!process.env.ONESHOT_API_KEY) {
      return NextResponse.json({ error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
    }

    if (!body.signedDelegation && !body.delegationHash) {
      return NextResponse.json(
        { error: 'signedDelegation or delegationHash is required' },
        { status: 400 },
      )
    }

    const chainId = body.chainId ?? ONESHOT.CHAIN_ID
    const { taskId } = await send7710Transaction({
      chainId,
      userOps: [
        body.signedDelegation
          ? { delegation: body.signedDelegation }
          : { delegationHash: body.delegationHash },
      ],
      destinationUrl: process.env.ONESHOT_WEBHOOK_URL,
    })

    return NextResponse.json({ taskId, status: 'submitted' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Relay delegate failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
