'use client'

import { useDelegations } from '@/hooks/useDelegations'
import { DelegationTree } from '@/components/delegations/DelegationTree'
import { DelegationCard } from '@/components/delegations/DelegationCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

import { Button } from '@/components/ui/Button'
import { useDelegationsStore } from '@/stores/delegations.store'

function exportProofBundle() {
  const delegations = useDelegationsStore.getState().delegations
  const blob = new Blob([JSON.stringify(delegations, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'forgeos-delegation-bundle.json'
  a.click()
  URL.revokeObjectURL(url)
}

export default function DelegationsPage() {
  const { delegations, tree, loading } = useDelegations()

  const active = delegations.filter((d) => d.status === 'active')

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Permissions</h1>
          <p className="mt-1 text-sm text-forge-text-muted">Everything you have approved — and what each agent is allowed to do.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={exportProofBundle}>
            Download backup
          </Button>
          <p className="text-sm text-forge-text-muted">
            {active.length} of {delegations.length} active
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-24" />
          <LoadingSkeleton className="ml-6 h-20" />
          <LoadingSkeleton className="ml-12 h-20" />
        </div>
      ) : delegations.length === 0 ? (
        <EmptyState
          title="Nothing approved yet"
          description="Once you finish setup, you will see exactly what each agent is allowed to do — all in one place."
        />
      ) : (
        <>
          {/* ── Delegation chain (tree view) ── */}
          {tree && (
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold">How access flows</h2>
                <p className="text-xs text-forge-text-subtle">
                  See exactly who can do what, from your account down to each agent
                </p>
              </div>
              <DelegationTree root={tree} />
            </section>
          )}

          {/* ── All active delegations (flat list) ── */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold">Active permissions</h2>
              <p className="text-xs text-forge-text-subtle">
                Turn off any agent here — your main account setup stays safe
              </p>
            </div>
            {active.length === 0 ? (
              <p className="text-sm text-forge-text-muted">Nothing active right now.</p>
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
