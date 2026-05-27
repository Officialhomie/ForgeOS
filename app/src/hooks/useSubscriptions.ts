'use client'

import { useMemo } from 'react'
import type { Subscription } from '@/types'

// ─── DERIVED TYPES ────────────────────────────────────────────────────────────

export interface SubscriptionDisplay extends Subscription {
  cyclesUsed: number
  cycleProgress: number   // 0–100 percent
  validAfter: number | null
  validBefore: number | null
  isExpired: boolean
  isComplete: boolean
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export function useSubscriptions(): {
  subscriptions: SubscriptionDisplay[]
  isLoading: boolean
} {
  const raw: Subscription[] = []

  const subscriptions = useMemo(
    () => raw.map(toDisplay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw.length],
  )

  return { subscriptions, isLoading: false }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function toDisplay(sub: Subscription): SubscriptionDisplay {
  const cyclesUsed = sub.maxPayments - sub.paymentsRemaining
  const cycleProgress = sub.maxPayments > 0
    ? Math.round((cyclesUsed / sub.maxPayments) * 100)
    : 0

  // Parse TimestampEnforcer caveat if present
  const timestampCaveat = sub.delegation.caveats.find(
    (c) => c.enforcerName === 'TimestampEnforcer',
  )
  const validAfter = timestampCaveat
    ? (timestampCaveat.decodedTerms.validAfter as number | undefined) ?? null
    : null
  const validBefore = timestampCaveat
    ? (timestampCaveat.decodedTerms.validBefore as number | undefined) ?? null
    : null

  const now = Math.floor(Date.now() / 1000)
  const isExpired = validBefore !== null && now > validBefore
  const isComplete = sub.paymentsRemaining === 0

  return {
    ...sub,
    cyclesUsed,
    cycleProgress,
    validAfter,
    validBefore,
    isExpired,
    isComplete,
  }
}
