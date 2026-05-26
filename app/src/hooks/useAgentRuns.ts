'use client'

import { useState, useCallback } from 'react'
import { isDemoMode } from '@/lib/demo'
import { MOCK_AGENT_RUNS } from '@/lib/mock-data'
import type { AgentId, AgentRun, RunStatus } from '@/types'

const PAGE_SIZE = 5

const SYNTH_STATUSES: RunStatus[] = [
  'confirmed',
  'confirmed',
  'confirmed',
  'failed',
  'confirmed',
  'confirmed',
  'reverted',
  'confirmed',
  'confirmed',
]

const SYNTH_TRIGGERS: AgentRun['trigger'][] = [
  'schedule', 'schedule', 'command', 'schedule', 'schedule',
  'event', 'schedule', 'command', 'schedule',
]

function buildSyntheticRuns(agentId: AgentId): AgentRun[] {
  const template = MOCK_AGENT_RUNS[0]
  const base = 1748390400 // ~May 28 2026

  return SYNTH_STATUSES.map((status, i) => {
    const triggeredAt = base - (i + 1) * 7200
    const isFailed = status === 'failed' || status === 'reverted'
    return {
      ...template,
      id: `run_synth_${agentId}_${i}`,
      agentId,
      trigger: SYNTH_TRIGGERS[i],
      triggeredAt,
      status,
      confirmedAt: status === 'confirmed' ? triggeredAt + 100 : null,
      failedAt: isFailed ? triggeredAt + 80 : null,
      failureReason:
        status === 'failed'
          ? 'Delegation caveat violation'
          : status === 'reverted'
            ? 'Transaction reverted'
            : null,
      cost: status === 'confirmed' ? 40000n : 0n,
      earnings: status === 'confirmed' ? BigInt(2_140000 - i * 100000) : 0n,
    }
  })
}

export function useAgentRuns(agentId: AgentId) {
  const [page, setPage] = useState(0)

  const allRuns: AgentRun[] = isDemoMode()
    ? agentId === 'defi-rebalancer'
      ? [...MOCK_AGENT_RUNS, ...buildSyntheticRuns(agentId)]
      : buildSyntheticRuns(agentId)
    : []

  const totalPages = Math.max(1, Math.ceil(allRuns.length / PAGE_SIZE))
  const runs = allRuns.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const nextPage = useCallback(() => setPage((p) => Math.min(p + 1, totalPages - 1)), [totalPages])
  const prevPage = useCallback(() => setPage((p) => Math.max(p - 1, 0)), [])

  return {
    runs,
    allRuns,
    page,
    totalPages,
    hasPrev: page > 0,
    hasNext: page < totalPages - 1,
    nextPage,
    prevPage,
  }
}
