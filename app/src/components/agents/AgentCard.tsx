'use client'

import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn, formatUsdc, timeAgo } from '@/lib/utils'
import type { Agent, AgentStatus } from '@/types'

// ─── STATUS MAP ───────────────────────────────────────────────────────────────

type BadgeVariant = 'active' | 'running' | 'paused' | 'error'

const STATUS_BADGE: Record<AgentStatus, BadgeVariant> = {
  active: 'active',
  running: 'running',
  paused: 'paused',
  inactive: 'paused',
  failed: 'error',
}

// ─── BUDGET BAR ───────────────────────────────────────────────────────────────

function BudgetBar({ spent, cap }: { spent: bigint; cap: bigint }) {
  const pct = cap === 0n ? 0 : Math.min(Number((spent * 10000n) / cap) / 100, 100)
  const color =
    pct >= 90
      ? 'bg-forge-danger'
      : pct >= 70
        ? 'bg-forge-warning'
        : 'bg-forge-orange'

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between text-[11px] text-forge-text-subtle">
        <span>{formatUsdc(spent)} spent</span>
        <span>{Math.round(pct)}% of cap</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-forge-elevated">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── SUCCESS RATE ─────────────────────────────────────────────────────────────

function successRate(runs: number, successes: number): string {
  if (runs === 0) return '—'
  return `${Math.round((successes / runs) * 100)}%`
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function AgentCard({
  agent,
  monthlySpent,
  monthlyCap,
}: {
  agent: Agent
  monthlySpent: bigint
  monthlyCap: bigint
}) {
  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="block rounded-xl border border-forge-border bg-forge-surface p-5 transition-colors hover:border-forge-orange/40 hover:bg-forge-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-orange"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-tight">{agent.name}</h2>
        <StatusBadge variant={STATUS_BADGE[agent.status]} className="shrink-0" />
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm text-forge-text-muted">{agent.description}</p>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold tabular-nums">{agent.runCount}</p>
          <p className="text-[11px] text-forge-text-subtle">Runs</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">
            {successRate(agent.runCount, agent.successCount)}
          </p>
          <p className="text-[11px] text-forge-text-subtle">Success</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{formatUsdc(agent.gasSaved)}</p>
          <p className="text-[11px] text-forge-text-subtle">Fees saved</p>
        </div>
      </div>

      {/* Budget bar — only for active/paused agents with delegations */}
      {agent.status !== 'inactive' && agent.delegation !== null && (
        <BudgetBar spent={monthlySpent} cap={monthlyCap} />
      )}

      {agent.lastRunAt !== null && (
        <p className="mt-3 text-xs text-forge-text-subtle">Last run {timeAgo(agent.lastRunAt)}</p>
      )}
    </Link>
  )
}
