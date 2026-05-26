'use client'

import { useState } from 'react'
import { cn, truncateAddress, timeAgo } from '@/lib/utils'
import { CaveatList } from './CaveatList'
import type { Delegation } from '@/types'

// ─── HOP BADGE ────────────────────────────────────────────────────────────────

const HOP_STYLES: Record<string, string> = {
  root: 'border-forge-orange/40 bg-forge-orange/10 text-forge-orange',
  sub: 'border-blue-400/40 bg-blue-400/10 text-blue-400',
  redelegation: 'border-amber-400/40 bg-amber-400/10 text-amber-400',
}

// ─── CHEVRON ──────────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={cn('shrink-0 transition-transform', open && 'rotate-180')}
    >
      <path
        d="M2 4l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── SINGLE NODE ──────────────────────────────────────────────────────────────

function DelegationNode({ delegation, depth }: { delegation: Delegation; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)

  return (
    <div style={{ marginLeft: depth === 0 ? '0px' : `${depth * 24}px` }}>
      {depth > 0 && (
        <div className="mb-1 ml-3 h-4 border-l border-forge-border" aria-hidden />
      )}

      <div
        className={cn(
          'rounded-xl border bg-forge-surface transition-colors',
          expanded ? 'border-forge-border/80' : 'border-forge-border',
        )}
      >
        {/* Header row */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full flex-wrap items-center gap-2 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-orange focus-visible:ring-inset"
          aria-expanded={expanded}
        >
          <span
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase',
              HOP_STYLES[delegation.hop] ?? HOP_STYLES.sub,
            )}
          >
            {delegation.hop}
          </span>

          <span className="font-mono text-xs text-forge-text">
            {truncateAddress(delegation.delegator)}
          </span>
          <span className="text-forge-text-subtle" aria-hidden>
            →
          </span>
          <span className="font-mono text-xs text-forge-text">
            {truncateAddress(delegation.delegate)}
          </span>

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

          <span className="ml-auto text-forge-text-subtle">
            <Chevron open={expanded} />
          </span>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-forge-border px-4 pb-4 pt-3">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-forge-text-subtle">
              Caveats
            </p>
            <CaveatList caveats={delegation.caveats} />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-forge-text-subtle">
              <span>Issued {timeAgo(delegation.issuedAt)}</span>
              {delegation.lastUsedAt !== null && (
                <span>Last used {timeAgo(delegation.lastUsedAt)}</span>
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] text-forge-text-subtle">
              {delegation.hash.slice(0, 22)}…
            </p>
          </div>
        )}
      </div>

      {/* Recursive children */}
      {delegation.children.map((child) => (
        <DelegationNode key={child.hash} delegation={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ─── TREE ROOT ────────────────────────────────────────────────────────────────

export function DelegationTree({ root }: { root: Delegation }) {
  return (
    <div className="space-y-0">
      <DelegationNode delegation={root} depth={0} />
    </div>
  )
}
