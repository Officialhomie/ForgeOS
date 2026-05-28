'use client'

import { useState } from 'react'
import { useAgents } from '@/hooks/useAgents'
import { useTreasury } from '@/hooks/useTreasury'
import { AgentCard } from '@/components/agents/AgentCard'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@/types'

// ─── FILTER OPTIONS ───────────────────────────────────────────────────────────

type Filter = 'all' | AgentStatus

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Running', value: 'running' },
  { label: 'Paused', value: 'paused' },
  { label: 'Inactive', value: 'inactive' },
]

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { agents, loading } = useAgents()
  const { treasury } = useTreasury()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered =
    filter === 'all' ? agents : agents.filter((a) => a.status === filter)

  const monthlyCap = treasury?.monthlyUsage.cap ?? 0n

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your agents</h1>
          <p className="mt-1 text-sm text-forge-text-muted">All the helpers you have running or on standby.</p>
        </div>
        <p className="text-sm text-forge-text-muted">{agents.length} installed</p>
      </div>

      {/* ── Filter toolbar ── */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-orange',
              filter === value
                ? 'border-forge-orange bg-forge-orange/10 text-forge-orange'
                : 'border-forge-border bg-forge-surface text-forge-text-muted hover:border-forge-border/80 hover:text-forge-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-52" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No agents yet' : `No ${filter} agents`}
          description={
            filter === 'all'
              ? 'Head to the marketplace and pick an agent — it takes seconds to set one up.'
              : 'Try a different filter to see more agents.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              monthlySpent={treasury?.monthlyUsage.perAgent[agent.id] ?? 0n}
              monthlyCap={monthlyCap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
