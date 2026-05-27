'use client'

import { useSubDelegations } from '@/hooks/useSubDelegations'

export function SubDelegationBanner() {
  const { ready, error, loading } = useSubDelegations()

  if (ready || (!error && !loading)) return null

  return (
    <div
      className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      role="alert"
    >
      {loading && <p>Creating on-chain A2A sub-delegation chain…</p>}
      {error && (
        <p>
          Sub-delegation setup failed: {error}. Command execution and cron runs are blocked until
          this is resolved.
        </p>
      )}
    </div>
  )
}
