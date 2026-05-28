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
      {loading && <p>Setting up agent permissions in the background…</p>}
      {error && (
        <div>
          <p className="font-medium">Agent setup hit a snag</p>
          <p className="mt-1 text-xs text-amber-300/80">
            {error} Some agent actions may be limited — this often resolves on its own.
          </p>
        </div>
      )}
    </div>
  )
}
