/**
 * POST /api/relay/revoke-all — OSKernel.revokeAll() via owner-signed RPC transaction.
 *
 * Requires FORGE_OWNER_KEY: the private key of the address that owns the deployed OSKernel.
 * Owner operations cannot go through the ERC-7710 relay (which requires delegation proofs).
 * The relay model is for delegation-authorized execution; revoke is an owner-only operation.
 */

import { NextResponse } from 'next/server'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { activityEmitter } from '@/lib/events/activity-emitter'
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
  const ownerKey = process.env.FORGE_OWNER_KEY
  if (!ownerKey) {
    return NextResponse.json(
      {
        success: false,
        error:
          'FORGE_OWNER_KEY not configured. OSKernel.revokeAll() is onlyOwner — ' +
          'set FORGE_OWNER_KEY to the private key of the OSKernel contract owner.',
        code: 'OWNER_KEY_REQUIRED',
      },
      { status: 503 },
    )
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
      functionName: 'revokeAll',
    })

    const pendingEvent: ActivityEvent = {
      id: `kill_switch_${txHash}`,
      type: 'os_revoked',
      agentId: null,
      title: 'Kill switch activated',
      description: `OSKernel.revokeAll() submitted — ${delegations.length} delegation(s)`,
      amount: null,
      txHash,
      delegationHash: null,
      taskId: null,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
      source: 'rpc',
    }
    activityEmitter.emitActivity(pendingEvent)

    return NextResponse.json({ success: true, txHash })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'revokeAll failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
