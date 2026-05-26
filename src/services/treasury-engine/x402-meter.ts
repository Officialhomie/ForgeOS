/**
 * P9.2 — x402 Metering via ERC-7710 Delegation Proof
 *
 * Fires AgentTreasury.executePayment() using the subscription delegation proof.
 * No approve() or permit() — delegation proof IS the payment authority.
 *
 * Track evidence:
 *  - Best x402 + ERC-7710: delegation proof drives payment, no approve()
 *  - Best Agent: autonomous payment loop, user signs once at subscription creation
 *  - Best 1Shot: webhook-based confirmation
 */

import { encodeFunctionData, keccak256, stringToBytes } from 'viem'
import { send7710Transaction } from '@/lib/oneshot/client'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { activityEmitter } from '@/lib/events/activity-emitter'
import type { Subscription, ActivityEvent, AgentId } from '@/types'

// ─── AGENT TREASURY ABI (executePayment only) ─────────────────────────────────

const AGENT_TREASURY_ABI = [
  {
    name: 'executePayment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'payee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'agentId', type: 'bytes32' },
      { name: 'proof', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

/** Matches ForgeOSRegistry / AgentTreasury.t.sol: keccak256("payment-executor") */
function agentIdToBytes32(agentId: string): `0x${string}` {
  return keccak256(stringToBytes(agentId))
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface X402CycleResult {
  taskId: string
  cycleCost: bigint
  model: string
}

export interface X402MeterOptions {
  subscription: Subscription
  treasuryAddress: `0x${string}`
  /** ABI-encoded ERC-7710 delegation proof bytes */
  delegationProof: `0x${string}`
  veniceModel?: string
}

// ─── LIVE MODE ────────────────────────────────────────────────────────────────

/**
 * Execute one subscription payment cycle via ERC-7710 delegation proof.
 *
 * The delegation proof carries the signed ERC-7710 delegation struct.
 * AgentTreasury validates the 3 caveats on-chain before transferring USDC.
 * No approve() or permit() is ever called.
 */
export async function executeX402Cycle(options: X402MeterOptions): Promise<X402CycleResult> {
  const { subscription, treasuryAddress, delegationProof, veniceModel = 'llama-3.3-70b' } = options

  const callData = encodeFunctionData({
    abi: AGENT_TREASURY_ABI,
    functionName: 'executePayment',
    args: [
      subscription.recipient,
      subscription.amount,
      agentIdToBytes32(subscription.agentId),
      delegationProof,
    ],
  })

  const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

  const chainHashes = [subscription.delegation.authority, subscription.delegation.hash].filter(
    (h): h is `0x${string}` => h !== 'ROOT',
  )

  const { taskId } = await send7710Transaction({
    chainId: ONESHOT.CHAIN_ID,
    userOps: [
      {
        sender: subscription.delegation.delegator,
        callData,
        target: treasuryAddress,
        value: '0',
        delegationChain: chainHashes,
        delegation: subscription.delegation,
        nonce: 0,
      },
    ],
    destinationUrl: webhookUrl,
  })

  const activity: ActivityEvent = {
    id: `x402_${taskId}`,
    type: 'subscription_payment',
    agentId: subscription.agentId as AgentId,
    title: `${subscription.name} payment`,
    description: `${Number(subscription.amount) / 1_000_000} USDC → ${subscription.recipient.slice(0, 6)}...${subscription.recipient.slice(-4)}`,
    amount: subscription.amount,
    txHash: null,
    delegationHash: subscription.delegation.hash,
    timestamp: Math.floor(Date.now() / 1000),
    status: 'pending',
  }
  activityEmitter.emitActivity(activity)

  return { taskId, cycleCost: subscription.amount, model: veniceModel }
}

// ─── DEMO MODE ────────────────────────────────────────────────────────────────

export function executeX402CycleDemo(subscription: Subscription): X402CycleResult {
  const taskId = `demo-x402-${Date.now()}`
  const mockTxHash = `0xX402${Date.now().toString(16).padStart(60, '0')}` as `0x${string}`

  const activity: ActivityEvent = {
    id: `x402_${taskId}`,
    type: 'subscription_payment',
    agentId: subscription.agentId as AgentId,
    title: `${subscription.name} payment (demo)`,
    description: `${Number(subscription.amount) / 1_000_000} USDC → ${subscription.recipient.slice(0, 6)}...${subscription.recipient.slice(-4)}`,
    amount: subscription.amount,
    txHash: mockTxHash,
    delegationHash: subscription.delegation.hash,
    timestamp: Math.floor(Date.now() / 1000),
    status: 'confirmed',
  }
  activityEmitter.emitActivity(activity)

  return { taskId, cycleCost: subscription.amount, model: 'llama-3.3-70b' }
}
