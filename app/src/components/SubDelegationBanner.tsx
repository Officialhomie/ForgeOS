'use client'

import { useSubDelegations } from '@/hooks/useSubDelegations'

export function SubDelegationBanner() {
  const { ready, relaySkipped, error, loading } = useSubDelegations()

  if (ready && !relaySkipped && !error && !loading) return null

  // Relay was skipped — delegations are local-only, not registered on-chain.
  if (ready && relaySkipped) {
    return (
      <div
        className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200"
        role="alert"
      >
        <p className="font-medium">Delegations not yet on-chain</p>
        <p className="mt-1 text-xs text-yellow-300/80">
          The 1Shot relay is unavailable on this network. Agent permissions are stored
          locally but have not been registered on Sepolia. On-chain execution requires
          relay availability.
        </p>
      </div>
    )
  }

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
