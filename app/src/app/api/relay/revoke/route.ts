/**
 * POST /api/relay/revoke — OSKernel.revokeOne() via owner-signed RPC transaction.
 *
 * Requires FORGE_OWNER_KEY: the private key of the address that owns the deployed OSKernel.
 * Owner operations cannot go through the ERC-7710 relay (which requires delegation proofs).
 */

import { NextResponse } from 'next/server'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { CONTRACTS } from '@/lib/contracts'
import type { ActivityEvent, Hash } from '@/types'

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
  const ownerKey = process.env.FORGE_OWNER_KEY
  if (!ownerKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'FORGE_OWNER_KEY not configured. OSKernel.revokeOne() is onlyOwner — ' +
          'set FORGE_OWNER_KEY to the private key of the OSKernel contract owner.',
        code: 'OWNER_KEY_REQUIRED',
      },
      { status: 503 },
    )
  }

  try {
    const body = (await request.json()) as { delegationHash?: Hash }

    if (!body.delegationHash) {
      return NextResponse.json(
        { success: false, error: 'Missing delegationHash' },
        { status: 400 },
      )
    }

    const kernelAddress = CONTRACTS.osKernel
    const account = privateKeyToAccount(ownerKey as `0x${string}`)
    const rpcUrl =
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
      process.env.NEXT_PUBLIC_RPC_URL ??
      'https://rpc.ankr.com/eth_sepolia'

    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(rpcUrl),
    })

    const txHash = await walletClient.writeContract({
      account,
      address: kernelAddress,
      abi: OS_KERNEL_ABI,
      functionName: 'revokeOne',
      args: [body.delegationHash],
    })

    const pendingEvent: ActivityEvent = {
      id: `revoke_one_${txHash}`,
      type: 'delegation_revoked',
      agentId: null,
      title: 'Delegation revoked',
      description: `OSKernel.revokeOne() submitted`,
      amount: null,
      txHash,
      delegationHash: body.delegationHash,
      taskId: null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
      source: 'rpc',
    }
    activityEmitter.emitActivity(pendingEvent)

    return NextResponse.json({ success: true, txHash })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Revoke failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
