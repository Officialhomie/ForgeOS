/**
 * P12.1 — Kill Switch hook
 *
 * Calls OSKernel.revokeAll() via 1Shot relay.
 * Optimistic UI: immediately marks all delegations as revoked in Zustand
 * before the tx confirms. On webhook Rejected: restores state + shows error.
 *
 * Track evidence: Best Agent (safety / emergency revoke UX)
 */

'use client'

import { useState } from 'react'
import { isDemoMode } from '@/lib/demo'
import { useDelegationsStore } from '@/stores/delegations.store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import type { ActivityEvent } from '@/types'

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

  const delegations = useDelegationsStore((s) => s.delegations)
  const setDelegations = useDelegationsStore((s) => s.setDelegations)

  const activeDelegationCount = delegations.filter((d) => d.status === 'active').length

  async function revokeAll() {
    setIsPending(true)
    setError(null)

    // Optimistic update — immediately mark all delegations revoked in UI
    const snapshot = delegations
    const revoked = delegations.map((d) => ({ ...d, status: 'revoked' as const }))
    setDelegations(revoked)

    if (isDemoMode()) {
      await new Promise<void>((r) => setTimeout(r, 900))

      const event: ActivityEvent = {
        id: `kill_switch_demo_${Date.now()}`,
        type: 'os_revoked',
        agentId: null,
        title: 'All delegations revoked (demo)',
        description: `${activeDelegationCount} delegation(s) atomically revoked via OSKernel.revokeAll()`,
        amount: null,
        txHash: `0xKILL${Date.now().toString(16).padStart(60, '0')}` as `0x${string}`,
        delegationHash: null,
        timestamp: Math.floor(Date.now() / 1000),
        status: 'confirmed',
      }
      activityEmitter.emitActivity(event)

      setIsRevoked(true)
      setIsPending(false)
      return
    }

    // Live mode
    try {
      const res = await fetch('/api/relay/revoke-all', { method: 'POST' })
      const data = (await res.json()) as { success: boolean; error?: string; taskId?: string }

      if (!data.success) {
        throw new Error(data.error ?? 'revokeAll relay failed')
      }

      setIsRevoked(true)
    } catch (e) {
      // Restore snapshot on failure
      setDelegations(snapshot)
      setError(e instanceof Error ? e.message : 'Kill switch failed')
    } finally {
      setIsPending(false)
    }
  }

  function reset() {
    setIsRevoked(false)
    setError(null)
  }

  return { isPending, isRevoked, error, activeDelegationCount, revokeAll, reset }
}
