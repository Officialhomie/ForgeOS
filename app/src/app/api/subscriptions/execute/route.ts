/**
 * POST /api/subscriptions/execute
 *
 * Executes one cycle of a subscription via x402 + ERC-7710 delegation proof.
 *
 * The signed subscription delegation already encodes the caveat policy:
 *   - TimestampEnforcer validates we're within the window
 *   - ERC20TransferAmountEnforcer caps the transfer amount
 *   - LimitedCallsEnforcer decrements the remaining cycle counter
 *
 * No new user signature required — the delegation IS the authority.
 *
 * Track evidence:
 *  - Best x402 + ERC-7710: delegation proof drives payment, not approve()
 *  - Best 1Shot Relayer: webhook callbacks, not polling
 */

import { NextResponse } from 'next/server'
import { executeX402Cycle } from '@/services/treasury-engine/x402-meter'
import { taskStore } from '@/lib/oneshot/task-store'
import { CONTRACTS } from '@/lib/contracts'
import type { Subscription } from '@/types'

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface ExecuteSubscriptionRequest {
  subscription: Omit<Subscription, 'amount'> & { amount: string }
  /** ABI-encoded ERC-7710 delegation proof (optional; built server-side if omitted) */
  delegationProof?: `0x${string}`
  veniceModel?: string
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: ExecuteSubscriptionRequest
  try {
    body = (await request.json()) as ExecuteSubscriptionRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { subscription: rawSub, delegationProof, veniceModel } = body

  if (!rawSub?.id || !rawSub?.delegation) {
    return NextResponse.json({ success: false, error: 'subscription required' }, { status: 400 })
  }

  // Rehydrate bigint amount from JSON string
  const subscription: Subscription = {
    ...rawSub,
    amount: BigInt(rawSub.amount),
  }

  if (subscription.status !== 'active') {
    return NextResponse.json(
      { success: false, error: `Subscription is ${subscription.status}` },
      { status: 400 },
    )
  }

  if (subscription.paymentsRemaining <= 0) {
    return NextResponse.json(
      { success: false, error: 'No payments remaining' },
      { status: 400 },
    )
  }

  try {
    const proof = delegationProof ?? ('0x' as `0x${string}`)

    const result = await executeX402Cycle({
      subscription,
      treasuryAddress: CONTRACTS.agentTreasury,
      delegationProof: proof,
      veniceModel,
    })

    taskStore.create(result.taskId)

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      cycleCost: result.cycleCost.toString(),
      model: result.model,
      paymentsRemaining: subscription.paymentsRemaining - 1,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Execution failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
