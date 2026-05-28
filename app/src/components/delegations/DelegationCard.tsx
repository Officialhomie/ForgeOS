'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { CaveatList } from './CaveatList'
import { RevokeDelegationModal } from './RevokeDelegationModal'
import type { Delegation } from '@/types'

// ─── HOP BADGE ────────────────────────────────────────────────────────────────

const HOP_STYLES: Record<string, string> = {
  root: 'border-forge-orange/40 bg-forge-orange/10 text-forge-orange',
  sub: 'border-blue-400/40 bg-blue-400/10 text-blue-400',
  redelegation: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
}

const HOP_LABELS: Record<string, string> = {
  root: 'main',
  sub: 'agent',
  redelegation: 'shared',
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function DelegationCard({ delegation }: { delegation: Delegation }) {
  const [expanded, setExpanded] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)

  return (
    <>
      <div className="rounded-xl border border-forge-border bg-forge-surface">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 p-4">
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
              HOP_STYLES[delegation.hop] ?? HOP_STYLES.sub,
            )}
          >
            {HOP_LABELS[delegation.hop] ?? delegation.hop}
          </span>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <AddressDisplay address={delegation.delegator} />
            <span className="text-forge-text-subtle" aria-hidden>
              →
            </span>
            <AddressDisplay address={delegation.delegate} />
          </div>

          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px]',
              delegation.status === 'active'
                ? 'bg-forge-success/10 text-forge-success'
                : 'bg-forge-danger/10 text-forge-danger',
            )}
          >
            {delegation.status}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-forge-text-subtle hover:text-forge-text"
            >
              {expanded
                ? 'Hide rules'
                : `${delegation.caveats.length} rule${delegation.caveats.length !== 1 ? 's' : ''}`}
            </button>

            {delegation.status === 'active' && delegation.hop !== 'root' && (
              <button
                type="button"
                onClick={() => setRevokeOpen(true)}
                className="rounded border border-forge-danger/40 px-2 py-0.5 text-[11px] text-forge-danger transition-colors hover:bg-forge-danger/10"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Expanded caveats */}
        {expanded && (
          <div className="border-t border-forge-border px-4 pb-4 pt-3">
            <CaveatList caveats={delegation.caveats} />
            <p className="mt-2 font-mono text-[10px] text-forge-text-subtle">
              ID: {delegation.hash.slice(0, 26)}…
            </p>
          </div>
        )}
      </div>

      {revokeOpen && (
        <RevokeDelegationModal
          delegation={delegation}
          onClose={() => setRevokeOpen(false)}
        />
      )}
    </>
  )
}
