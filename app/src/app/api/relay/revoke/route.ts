import { NextResponse } from 'next/server'
import { encodeFunctionData } from 'viem'
import { send7710Transaction } from '@/lib/oneshot/client'
import { CONTRACTS } from '@/lib/contracts'
import { APP_URL, ONESHOT } from '@/lib/constants'
import type { Hash } from '@/types'

const OS_KERNEL_ABI = [
  {
    name: 'revokeOne',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegationHash', type: 'bytes32' }],
    outputs: [],
  },
] as const

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { delegationHash?: Hash }

    if (!body.delegationHash) {
      return NextResponse.json(
        { success: false, error: 'Missing delegationHash' },
        { status: 400 },
      )
    }

    if (!process.env.ONESHOT_API_KEY) {
      return NextResponse.json({ success: false, error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
    }

    const kernelAddress = CONTRACTS.osKernel
    const callData = encodeFunctionData({
      abi: OS_KERNEL_ABI,
      functionName: 'revokeOne',
      args: [body.delegationHash],
    })

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps: [
        {
          sender: kernelAddress,
          target: kernelAddress,
          value: '0',
          nonce: 0,
          callData,
        },
      ],
      destinationUrl: process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`,
    })

    return NextResponse.json({ success: true, taskId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Revoke relay failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
