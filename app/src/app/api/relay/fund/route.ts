/**
 * POST /api/relay/fund
 *
 * Funds the AgentTreasury contract via 1Shot relay.
 * Encodes AgentTreasury.fund(uint256 amount) calldata properly so the
 * 1Shot relayer can submit it as a real on-chain transaction.
 *
 * Track evidence:
 *  - Best 1Shot: proper UserOp with ABI-encoded calldata
 *  - Best x402+7710: treasury funding enables downstream x402 payments
 */

import { NextResponse } from 'next/server'
import { encodeFunctionData, parseUnits } from 'viem'
import { ONESHOT, APP_URL } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'

// ─── ABI ─────────────────────────────────────────────────────────────────────

const AGENT_TREASURY_ABI = [
  {
    name: 'fund',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chainId?: number
      amountUsdc?: string
      treasuryAddress?: string
    }
    if (!process.env.ONESHOT_API_KEY) {
      return NextResponse.json({ error: 'ONESHOT_API_KEY not configured' }, { status: 503 })
    }

    const chainId = body.chainId ?? ONESHOT.CHAIN_ID
    const treasuryAddress = (body.treasuryAddress ?? CONTRACTS.agentTreasury) as `0x${string}`

    // Parse USDC amount with 6 decimals (e.g. "25" → 25_000_000n)
    const amountRaw = parseUnits(body.amountUsdc ?? '0', 6)
    if (amountRaw <= 0n) {
      return NextResponse.json({ error: 'amountUsdc must be greater than 0' }, { status: 400 })
    }

    // AgentTreasury.fund() uses transferFrom(msg.sender,...), so approve treasury
    // first, then call fund in the same relayed transaction bundle.
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [treasuryAddress, amountRaw],
    })

    const fundData = encodeFunctionData({
      abi: AGENT_TREASURY_ABI,
      functionName: 'fund',
      args: [amountRaw],
    })

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId,
      userOps: [
        {
          target: CONTRACTS.usdc,
          callData: approveData,
          value: '0',
          nonce: 0,
          delegationChain: [],
          delegationProofs: [],
        },
        {
          target: treasuryAddress,
          callData: fundData,
          value: '0',
          nonce: 0,
          delegationChain: [],
          delegationProofs: [],
        },
      ],
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)
    return NextResponse.json({ success: true, taskId, status: 'submitted' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Relay fund failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
