'use client'

import Link from 'next/link'
import { Tooltip } from '@/components/ui/Tooltip'
import { SystemHealthBar } from '@/components/ui/SystemHealthBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenAmount } from '@/components/ui/TokenAmount'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { Button } from '@/components/ui/Button'
import { useAgents } from '@/hooks/useAgents'
import { useTreasury } from '@/hooks/useTreasury'
import { useActivity } from '@/hooks/useActivity'
import { useDelegations } from '@/hooks/useDelegations'
import { timeAgo } from '@/lib/utils'

export default function DashboardPage() {
  const { agents, loading: agentsLoading } = useAgents()
  const { treasury, loading: treasuryLoading } = useTreasury()
  const { activity } = useActivity()
  const { delegations } = useDelegations()
  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'running')

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-forge-text">Home</h1>
        <p className="mt-1 text-sm text-forge-text-muted">
          Everything in one place — what your agents are up to, what they have spent, and anything that needs you.
        </p>
      </div>

      {/* Service health — surfaces Venice / 1Shot / chain status in real time */}
      <SystemHealthBar className="rounded-xl border border-forge-border bg-forge-surface px-4 py-2.5" />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 rounded-xl border border-forge-border bg-forge-surface p-5 md:col-span-4">
          <span className="inline-flex items-center gap-1 text-xs text-forge-text-muted">
            Funds available
            <Tooltip content="Money your agents can spend. They draw from this pool when they run tasks. Add more anytime on the Spending page." side="bottom" />
          </span>
          {treasuryLoading ? (
            <LoadingSkeleton className="mt-2 h-9 w-32" />
          ) : treasury ? (
            <p className="mt-2 text-3xl font-bold tabular-nums">
              <TokenAmount amount={treasury.usdcBalance} />
            </p>
          ) : (
            <p className="mt-2 text-sm text-forge-text-subtle">—</p>
          )}
        </div>
        <div className="col-span-12 rounded-xl border border-forge-border bg-forge-surface p-5 md:col-span-4">
          <span className="inline-flex items-center gap-1 text-xs text-forge-text-muted">
            Agents running
            <Tooltip content="Agents that are turned on and may run on their own schedule in the background." side="bottom" />
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {agentsLoading ? '—' : activeAgents.length}
          </p>
        </div>
        <div className="col-span-12 rounded-xl border border-forge-border bg-forge-surface p-5 md:col-span-4">
          <span className="inline-flex items-center gap-1 text-xs text-forge-text-muted">
            Active approvals
            <Tooltip content="How many agents you have allowed to act for you, each with limits you set. You can turn any of them off at any time." side="bottom" />
          </span>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {delegations.filter((d) => d.status === 'active').length}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-forge-border bg-forge-surface p-5">
        <h2 className="text-base font-semibold">Your agents</h2>
        {agentsLoading ? (
          <div className="mt-4 space-y-2">
            <LoadingSkeleton className="h-12 w-full" />
            <LoadingSkeleton className="h-12 w-full" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            title="No agents yet"
            description="Pick an agent from the marketplace or build your own — it only takes a minute to get started."
            action={
              <Link href="/marketplace">
                <Button>Browse agents</Button>
              </Link>
            }
          />
        ) : (
          <ul className="mt-4 divide-y divide-forge-border-subtle">
            {agents.slice(0, 4).map((agent) => (
              <li
                key={agent.id}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-forge-text-muted">
                    {agent.lastRunAt ? timeAgo(agent.lastRunAt) : 'Never run'}
                  </p>
                </div>
                <StatusBadge
                  variant={
                    agent.status === 'running'
                      ? 'running'
                      : agent.status === 'paused'
                        ? 'paused'
                        : agent.status === 'failed'
                          ? 'error'
                          : 'active'
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-forge-border bg-forge-surface p-5">
        <h2 className="text-base font-semibold">What happened lately</h2>
        <ul className="mt-4 space-y-3">
          {activity.slice(0, 5).map((event) => (
            <li key={event.id} className="flex justify-between text-sm">
              <span>{event.title}</span>
              <span className="text-forge-text-subtle">{timeAgo(event.timestamp)}</span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  )
}
