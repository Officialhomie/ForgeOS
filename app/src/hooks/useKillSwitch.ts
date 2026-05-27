'use client'

import { useState, useEffect, useRef } from 'react'
import { useDelegationsStore } from '@/stores/delegations.store'
import { useActivityStore } from '@/stores/activity.store'

export interface KillSwitchState {
  isPending: boolean
  isRevoked: boolean
  error: string | null
  activeDelegationCount: number
  revokeAll: () => Promise<void>
  reset: () => void
}

export function useKillSwitch(): KillSwitchState {
  const [isPending, setIsPending] = useState(false)
  const [isRevoked, setIsRevoked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingTaskId = useRef<string | null>(null)
  const snapshotRef = useRef<ReturnType<typeof useDelegationsStore.getState>['delegations']>([])

  const delegations = useDelegationsStore((s) => s.delegations)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)
  const activities = useActivityStore((s) => s.activityFeed)

  const activeDelegationCount = delegations.filter((d) => d.status === 'active').length

  useEffect(() => {
    const taskId = pendingTaskId.current
    if (!taskId) return

    const match = activities.find(
      (a) => a.taskId === taskId && (a.status === 'confirmed' || a.status === 'failed'),
    )
    if (!match) return

    if (match.type === 'kill_switch_failed' || match.status === 'failed') {
      setDelegations(snapshotRef.current)
      setError(match.description || 'Kill switch transaction failed')
      setIsRevoked(false)
    } else if (match.status === 'confirmed') {
      setIsRevoked(true)
    }

    pendingTaskId.current = null
    setIsPending(false)
  }, [activities, setDelegations])

  async function revokeAll() {
    setIsPending(true)
    setError(null)

    snapshotRef.current = delegations
    const revoked = delegations.map((d) => ({ ...d, status: 'revoked' as const }))
    setDelegations(revoked)

    try {
      const res = await fetch('/api/relay/revoke-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delegations }),
      })
      const data = (await res.json()) as { success: boolean; error?: string; taskId?: string }

      if (!data.success) {
        throw new Error(data.error ?? 'revokeAll relay failed')
      }

      if (data.taskId) {
        pendingTaskId.current = data.taskId
      } else {
        setIsRevoked(true)
        setIsPending(false)
      }
    } catch (e) {
      setDelegations(snapshotRef.current)
      setError(e instanceof Error ? e.message : 'Kill switch failed')
      setIsPending(false)
    }
  }

  function reset() {
    setIsRevoked(false)
    setError(null)
    pendingTaskId.current = null
  }

  return { isPending, isRevoked, error, activeDelegationCount, revokeAll, reset }
}
