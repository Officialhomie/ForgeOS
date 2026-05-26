/**
 * POST /api/subscriptions/create
 *
 * Builds a subscription delegation (TimestampEnforcer + ERC20 + LimitedCalls)
 * and submits it to 1Shot relay for on-chain activation.
 *
 * Returns the delegation hash and taskId. The subscription is live once
 * 1Shot confirms — subsequent cycles fire via /api/subscriptions/execute.
 *
 * Track evidence:
 *  - Best x402 + ERC-7710: subscription caveat set created here, drives all future cycles
 *  - Best 1Shot: relay_send7710Transaction with webhook URL
 */

import { NextResponse } from 'next/server'
import { isDemoMode } from '@/lib/demo'
import { createSubscriptionDelegation, subscriptionDelegationToForge } from '@/lib/delegation/createSubscriptionDelegation'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import type { Address, ActivityEvent, Subscription } from '@/types'

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface CreateSubscriptionRequest {
  name: string
  description: string
  recipient: Address
  /** USDC amount per cycle (6 decimals, passed as string to survive JSON) */
  amount: string
  /** Subscription window in seconds (default 30 days) */
  durationSeconds?: number
  /** Max payments (default 30) */
  maxPayments?: number
  /** Parent delegation hash (user → OSKernel, root of chain) */
  parentDelegationHash: `0x${string}`
  /** OSKernel address (delegator) */
  delegatorAddress: Address
  /** PaymentAgent address (delegate) */
  delegateAddress: Address
  agentId?: string
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: CreateSubscriptionRequest
  try {
    body = (await request.json()) as CreateSubscriptionRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    name,
    description,
    recipient,
    amount,
    durationSeconds = 30 * 24 * 60 * 60,
    maxPayments = 30,
    parentDelegationHash,
    delegatorAddress,
    delegateAddress,
    agentId = 'payment-executor',
  } = body

  if (!name || !recipient || !amount || !parentDelegationHash) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  const amountBigInt = BigInt(amount)

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (isDemoMode()) {
    const now = Math.floor(Date.now() / 1000)
    const taskId = `demo-sub-create-${Date.now()}`
    const mockHash = `0xSUB${Date.now().toString(16).padStart(61, '0')}` as `0x${string}`

    taskStore.create(taskId)
    taskStore.update(taskId, 'Confirmed', mockHash)

    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      name,
      description,
      recipient,
      amount: amountBigInt,
      frequencySeconds: Math.floor(durationSeconds / maxPayments),
      maxPayments,
      paymentsRemaining: maxPayments,
      status: 'active',
      delegation: {
        hash: mockHash,
        delegate: delegateAddress,
        delegator: delegatorAddress,
        authority: parentDelegationHash,
        caveats: [
          {
            enforcer: CONTRACTS.usdcSepolia,
            enforcerName: 'TimestampEnforcer',
            terms: '0x',
            decodedTerms: { validAfter: now, validBefore: now + durationSeconds },
            humanReadable: `Valid for ${Math.floor(durationSeconds / 86400)} days`,
          },
          {
            enforcer: CONTRACTS.usdcSepolia,
            enforcerName: 'ERC20TransferAmountEnforcer',
            terms: '0x',
            decodedTerms: { maxAmount: amount },
            humanReadable: `Max ${Number(amountBigInt) / 1_000_000} USDC per payment`,
          },
          {
            enforcer: CONTRACTS.usdcSepolia,
            enforcerName: 'LimitedCallsEnforcer',
            terms: '0x',
            decodedTerms: { limit: maxPayments },
            humanReadable: `Max ${maxPayments} payments`,
          },
        ],
        salt: '0x0000000000000000000000000000000000000000000000000000000000000001',
        signature: '0x' as `0x${string}`,
        hop: 'sub',
        status: 'active',
        issuedAt: now,
        lastUsedAt: null,
        agentId,
        parentDelegation: null,
        children: [],
      },
      nextPaymentAt: now + Math.floor(durationSeconds / maxPayments),
      lastPaymentAt: null,
      lastPaymentTx: null,
      createdAt: now,
      agentId: agentId as Subscription['agentId'],
    }

    const activity: ActivityEvent = {
      id: `sub_create_${taskId}`,
      type: 'delegation_issued',
      agentId: agentId as ActivityEvent['agentId'],
      title: `Subscription created: ${name}`,
      description: `${Number(amountBigInt) / 1_000_000} USDC × ${maxPayments} cycles (demo)`,
      amount: amountBigInt,
      txHash: mockHash,
      delegationHash: mockHash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'confirmed',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({ success: true, taskId, subscription, delegationHash: mockHash })
  }

  // ── Live mode ──────────────────────────────────────────────────────────────
  try {
    const { delegation, hash } = await createSubscriptionDelegation({
      delegator: delegatorAddress,
      delegate: delegateAddress,
      parentDelegationHash,
      durationSeconds,
      maxAmountPerCycle: amountBigInt,
      maxCycles: maxPayments,
    })

    const now = Math.floor(Date.now() / 1000)
    const forgeDelegation = subscriptionDelegationToForge(
      delegation,
      hash,
      agentId,
      now,
      now + durationSeconds,
      amountBigInt,
      maxPayments,
    )

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps: [
        {
          sender: delegatorAddress,
          callData: '0x' as `0x${string}`,
          target: delegateAddress,
          value: '0',
          delegationChain: [parentDelegationHash, hash],
          delegation: forgeDelegation,
          nonce: 0,
        },
      ],
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)

    const activity: ActivityEvent = {
      id: `sub_create_${taskId}`,
      type: 'delegation_issued',
      agentId: agentId as ActivityEvent['agentId'],
      title: `Subscription created: ${name}`,
      description: `${Number(amountBigInt) / 1_000_000} USDC × ${maxPayments} cycles`,
      amount: amountBigInt,
      txHash: null,
      delegationHash: hash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    }
    activityEmitter.emitActivity(activity)

    const subscription: Subscription = {
      id: `sub_${taskId}`,
      name,
      description,
      recipient,
      amount: amountBigInt,
      frequencySeconds: Math.floor(durationSeconds / maxPayments),
      maxPayments,
      paymentsRemaining: maxPayments,
      status: 'active',
      delegation: forgeDelegation,
      nextPaymentAt: now + Math.floor(durationSeconds / maxPayments),
      lastPaymentAt: null,
      lastPaymentTx: null,
      createdAt: now,
      agentId: agentId as Subscription['agentId'],
    }

    return NextResponse.json({ success: true, taskId, subscription, delegationHash: hash })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Subscription creation failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
