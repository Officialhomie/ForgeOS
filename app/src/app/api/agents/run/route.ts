/**
 * POST /api/agents/run — single agent execution (manual or cron).
 */

import { NextResponse } from 'next/server'
import { orchestrate } from '@/services/orchestrator'
import {
  buildAndValidateUserOps,
  delegationProofErrorResponse,
} from '@/lib/delegation/proof-validation'
import { getDelegationBundle } from '@/lib/delegation/bundle-store'
import { send7710Transaction } from '@/lib/oneshot/client'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import { createFlowTimer } from '@/lib/telemetry/flow-timer'
import { assertTreasuryForInference } from '@/lib/treasury/guard'
import { APP_URL, ONESHOT } from '@/lib/constants'
import { hasAgentWallet } from '@/lib/venice/client'
import { getTemplate } from '@/lib/agents/templates'
import type { AgentId, Address, Delegation, Hash, ActivityEvent } from '@/types'

interface AgentRunRequest {
  agentId: AgentId
  intent?: string
  rootDelegationHash?: Hash
  subDelegationHash?: Hash
  reDelegationHash?: Hash
  signedDelegations?: Delegation[]
  smartAccountAddress?: Address
  userAddress?: string
}

export async function POST(request: Request) {
  let body: AgentRunRequest
  try {
    body = (await request.json()) as AgentRunRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { agentId } = body
  if (!agentId) {
    return NextResponse.json({ success: false, error: 'agentId is required' }, { status: 400 })
  }

  if (!hasAgentWallet()) {
    return NextResponse.json(
      { success: false, error: 'Agent wallet not configured' },
      { status: 503 },
    )
  }

  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured' },
      { status: 503 },
    )
  }

  const treasuryCheck = await assertTreasuryForInference()
  if (!treasuryCheck.ok) {
    return NextResponse.json(
      { success: false, error: treasuryCheck.message, code: 'TREASURY_LOW' },
      { status: 402 },
    )
  }

  let signedDelegations = body.signedDelegations ?? []
  const smartAccount =
    body.smartAccountAddress ??
    (process.env.FORGE_SMART_ACCOUNT_ADDRESS as Address | undefined)

  if (signedDelegations.length === 0 && smartAccount) {
    signedDelegations = getDelegationBundle(smartAccount) ?? []
  }

  const root = signedDelegations.find((d) => d.hop === 'root')
  const sub = signedDelegations.find((d) => d.hop === 'sub')
  const re = signedDelegations.find((d) => d.hop === 'redelegation')

  const rootDelegationHash = body.rootDelegationHash ?? root?.hash
  const subDelegationHash = body.subDelegationHash ?? sub?.hash
  const reDelegationHash = body.reDelegationHash ?? re?.hash

  if (!rootDelegationHash || !subDelegationHash || !reDelegationHash) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Delegation hashes or signedDelegations bundle required. POST /api/delegations/bundle after activation.',
      },
      { status: 400 },
    )
  }

  const template = getTemplate(agentId)
  const intent = body.intent ?? template?.defaultPrompt ?? `Execute ${agentId} agent routine`
  const timer = createFlowTimer('agent_run')

  try {
    timer.checkpoint('venice_start')
    const { plan } = await orchestrate({
      intent,
      rootDelegationHash,
      subDelegationHash,
      reDelegationHash,
    })
    timer.checkpoint('venice_end')

    timer.checkpoint('build_start')
    const userOps = buildAndValidateUserOps({
      actions: plan.actions,
      signedDelegations,
      senderAddress: body.userAddress,
    })
    timer.checkpoint('build_end')

    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps,
      destinationUrl: webhookUrl,
    })

    taskStore.create(taskId)

    const activity: ActivityEvent = {
      id: `agent_run_${taskId}`,
      type: 'agent_run_confirmed',
      agentId,
      title: `${template?.name ?? agentId} triggered`,
      description: `Scheduled run — task ${taskId}`,
      amount: plan.estimatedCost,
      txHash: null,
      delegationHash: subDelegationHash,
      timestamp: Math.floor(Date.now() / 1000),
      status: 'pending',
    }
    activityEmitter.emitActivity(activity)

    return NextResponse.json({ success: true, taskId, agentId, timing: timer.end() })
  } catch (e) {
    const proofErr = delegationProofErrorResponse(e)
    if (proofErr) {
      return NextResponse.json(proofErr, { status: 422 })
    }
    const msg = e instanceof Error ? e.message : 'Agent run failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
