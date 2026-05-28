'use client'

import { useState, useCallback } from 'react'
import type { AgentId, AgentRun } from '@/types'

const PAGE_SIZE = 5

export function useAgentRuns(agentId: AgentId) {
  const [page, setPage] = useState(0)

  // Run history is populated via the activity stream (SSE) in live mode.
  const allRuns: AgentRun[] = []

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
