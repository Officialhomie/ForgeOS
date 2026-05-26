'use client'

import { useDelegations } from '@/hooks/useDelegations'
import { DelegationTree } from '@/components/delegations/DelegationTree'
import { DelegationCard } from '@/components/delegations/DelegationCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

export default function DelegationsPage() {
  const { delegations, tree, loading } = useDelegations()

  const active = delegations.filter((d) => d.status === 'active')

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Delegations</h1>
        <p className="text-sm text-forge-text-muted">
          {active.length} active of {delegations.length} total
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="ml-6 h-20" />
          <LoadingSkeleton className="ml-12 h-20" />
        </div>
      ) : delegations.length === 0 ? (
        <EmptyState
          title="No delegations found"
          description="Activate ForgeOS to create your root delegation and start the chain."
        />
      ) : (
        <>
          {/* ── Delegation chain (tree view) ── */}
          {tree && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">Delegation chain</h2>
                <p className="text-xs text-forge-text-subtle">
                  A2A redelegation hierarchy rooted at your Smart Account
                </p>
              </div>
              <DelegationTree root={tree} />
            </section>
          )}

          {/* ── All active delegations (flat list) ── */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">All delegations</h2>
              <p className="text-xs text-forge-text-subtle">
                Revoke individual delegations without affecting the root
              </p>
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-forge-text-muted">No active delegations.</p>
            ) : (
              <ul className="space-y-3">
                {active.map((d) => (
                  <li key={d.hash}>
                    <DelegationCard delegation={d} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
