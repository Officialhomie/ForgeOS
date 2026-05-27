/**
 * GET /api/cron/agent-runner — triggers enabled agents via /api/agents/run.
 */

import { NextResponse } from 'next/server'
import { APP_URL } from '@/lib/constants'
import { getDelegationBundle } from '@/lib/delegation/bundle-store'
import type { AgentId, Address, Hash } from '@/types'

interface ServerAgentConfig {
  agentId: AgentId
}

function getEnabledAgentIds(): AgentId[] {
  return (process.env.ENABLED_AGENTS ?? 'defi-rebalancer,payment-executor')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as AgentId[]
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const smartAccount = process.env.FORGE_SMART_ACCOUNT_ADDRESS as Address | undefined
  const bundle = smartAccount ? getDelegationBundle(smartAccount) : null

  const rootHash =
    (process.env.ROOT_DELEGATION_HASH as Hash | undefined) ??
    bundle?.find((d) => d.hop === 'root')?.hash
  const subHash =
    (process.env.SUB_DELEGATION_HASH as Hash | undefined) ??
    bundle?.find((d) => d.hop === 'sub')?.hash
  const reHash =
    (process.env.RE_DELEGATION_HASH as Hash | undefined) ??
    bundle?.find((d) => d.hop === 'redelegation')?.hash

  const agentIds = getEnabledAgentIds()

  if (agentIds.length === 0) {
    return NextResponse.json({ triggered: 0, message: 'No ENABLED_AGENTS configured' })
  }

  if (!bundle?.length && (!rootHash || !subHash || !reHash)) {
    return NextResponse.json({
      triggered: 0,
      message:
        'No delegation bundle. Set FORGE_SMART_ACCOUNT_ADDRESS and POST /api/delegations/bundle, or set ROOT_/SUB_/RE_DELEGATION_HASH env vars.',
    })
  }

  const results = await Promise.allSettled(
    agentIds.map(async (agentId) => {
      const res = await fetch(`${APP_URL}/api/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          rootDelegationHash: rootHash,
          subDelegationHash: subHash,
          reDelegationHash: reHash,
          signedDelegations: bundle ?? undefined,
          smartAccountAddress: smartAccount,
        }),
      })
      const data = (await res.json()) as { success: boolean; taskId?: string; error?: string }
      return { agentId, ...data }
    }),
  )

  const triggered = results.filter(
    (r) => r.status === 'fulfilled' && r.value.success,
  ).length

  return NextResponse.json({ triggered, total: agentIds.length, results })
}
