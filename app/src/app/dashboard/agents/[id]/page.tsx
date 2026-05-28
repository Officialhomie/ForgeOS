'use client'

import { use } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useAgent } from '@/hooks/useAgents'
import { useAgentRuns } from '@/hooks/useAgentRuns'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import {
  ActionPlanVisualizer,
  A2AChainVisualizer,
  runStatusToA2AState,
} from '@/components/agents/ActionPlanVisualizer'
import { RunHistoryTable } from '@/components/agents/RunHistoryTable'
import { CaveatList } from '@/components/delegations/CaveatList'
import { DelegationCard } from '@/components/delegations/DelegationCard'
import { cn, formatUsdc, timeAgo } from '@/lib/utils'
import type { AgentId, AgentStatus } from '@/types'

// ─── STATUS BADGE MAP ─────────────────────────────────────────────────────────

type BadgeVariant = 'active' | 'running' | 'paused' | 'error'

const STATUS_BADGE: Record<AgentStatus, BadgeVariant> = {
  active: 'active',
  running: 'running',
  paused: 'paused',
  inactive: 'paused',
  failed: 'error',
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
      <p className="text-xs text-forge-text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-forge-text-muted">{sub}</p>}
    </div>
  )
}

// ─── TAB TRIGGER ──────────────────────────────────────────────────────────────

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className={cn(
        'border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-forge-text-subtle transition-colors',
        'hover:border-forge-border hover:text-forge-text',
        'data-[state=active]:border-forge-orange data-[state=active]:text-forge-text',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-forge-orange focus-visible:ring-inset',
      )}
    >
      {children}
    </Tabs.Trigger>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const agent = useAgent(id as AgentId)
  const { runs, page, totalPages, hasPrev, hasNext, nextPage, prevPage } = useAgentRuns(
    id as AgentId,
  )

  if (!agent) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <LoadingSkeleton className="h-10 w-48" />
        <LoadingSkeleton className="h-48 w-full" />
      </div>
    )
  }

  const latestRun = runs[0] ?? null
  const successRate =
    agent.runCount === 0
      ? '—'
      : `${Math.round((agent.successCount / agent.runCount) * 100)}%`

  // A2A chain state derived from latest run status or agent status (P8.6)
  const a2aRunStatus =
    latestRun?.status ?? (agent.status === 'active' ? 'confirmed' : 'pending')
  const a2aState = runStatusToA2AState(a2aRunStatus)
  const hasA2A = agent.redelegations.length > 0
  const redelHash = agent.redelegations[0]?.hash
  const subHash = agent.delegation?.hash

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <StatusBadge variant={STATUS_BADGE[agent.status]} />
          </div>
          <p className="mt-1 text-sm text-forge-text-muted">{agent.description}</p>
        </div>
        {agent.delegation && (
          <div className="text-right text-xs text-forge-text-subtle">
            <p>Permission active</p>
            <AddressDisplay address={agent.delegation.delegate} />
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs.Root defaultValue="overview">
        <Tabs.List className="flex border-b border-forge-border">
          <TabTrigger value="overview">Overview</TabTrigger>
          <TabTrigger value="runs">Run History</TabTrigger>
          <TabTrigger value="delegation">Permissions</TabTrigger>
          <TabTrigger value="settings">Settings</TabTrigger>
        </Tabs.List>

        {/* ── Overview ── */}
        <Tabs.Content value="overview" className="mt-6 space-y-6 focus:outline-none">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total runs" value={String(agent.runCount)} />
            <MetricCard
              label="Success rate"
              value={successRate}
              sub={`${agent.failureCount} failed`}
            />
            <MetricCard label="Fees saved" value={formatUsdc(agent.gasSaved)} />
            <MetricCard
              label="Lifetime earnings"
              value={formatUsdc(agent.earningsLifetime)}
              sub={`${formatUsdc(agent.earningsToday)} today`}
            />
          </div>

          {latestRun ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Latest run{' '}
                <span className="font-normal text-forge-text-muted">
                  {timeAgo(latestRun.triggeredAt)}
                </span>
              </p>
              <ActionPlanVisualizer status={latestRun.status} />
              {latestRun.actionPlan && (
                <p className="text-sm text-forge-text-muted">{latestRun.actionPlan.summary}</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-forge-border p-8 text-center">
              <p className="text-sm text-forge-text-muted">No runs recorded yet.</p>
            </div>
          )}

          {/* P8.6 — A2A chain for agents with re-delegations */}
          {hasA2A && (
            <div className="space-y-2">
              <p className="text-sm font-medium">How this agent shares permissions</p>
              <A2AChainVisualizer state={a2aState} defiHash={subHash} redelHash={redelHash} />
            </div>
          )}
        </Tabs.Content>

        {/* ── Run History ── */}
        <Tabs.Content value="runs" className="mt-6 focus:outline-none">
          <RunHistoryTable
            runs={runs}
            page={page}
            totalPages={totalPages}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={prevPage}
            onNext={nextPage}
          />
        </Tabs.Content>

        {/* ── Delegation ── */}
        <Tabs.Content value="delegation" className="mt-6 space-y-6 focus:outline-none">
          {agent.delegation ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Active permission</p>
              <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
                <div className="mb-3 flex items-center gap-2 text-xs text-forge-text-subtle">
                  <span>From</span>
                  <AddressDisplay address={agent.delegation.delegator} />
                  <span>→</span>
                  <AddressDisplay address={agent.delegation.delegate} />
                </div>
                <CaveatList caveats={agent.delegation.caveats} />
                <p className="mt-3 font-mono text-[10px] text-forge-text-subtle">
                  Hash: {agent.delegation.hash.slice(0, 26)}…
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-forge-text-muted">No permission assigned to this agent yet.</p>
          )}

          {agent.redelegations.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Shared permissions{' '}
                <span className="text-forge-text-subtle">({agent.redelegations.length})</span>
              </p>
              {agent.redelegations.map((d) => (
                <DelegationCard key={d.hash} delegation={d} />
              ))}

              {/* P8.6 — Live A2A chain status */}
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium text-forge-text-muted">
                  Permission flow status
                </p>
                <A2AChainVisualizer state={a2aState} defiHash={subHash} redelHash={redelHash} />
              </div>
            </div>
          )}
        </Tabs.Content>

        {/* ── Settings ── */}
        <Tabs.Content value="settings" className="mt-6 space-y-6 focus:outline-none">
          <div className="space-y-3 rounded-xl border border-forge-border bg-forge-surface p-5">
            <h3 className="text-sm font-medium">Configuration</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-forge-text-subtle">AI model</p>
                <p className="font-mono text-forge-text">{agent.config.veniceModel}</p>
              </div>
              <div>
                <p className="text-xs text-forge-text-subtle">Schedule interval</p>
                <p className="text-forge-text">
                  {agent.config.scheduleInterval >= 3600
                    ? `${agent.config.scheduleInterval / 3600}h`
                    : `${agent.config.scheduleInterval / 60}m`}
                </p>
              </div>
              {agent.config.rebalanceThreshold !== undefined && (
                <div>
                  <p className="text-xs text-forge-text-subtle">Rebalance threshold</p>
                  <p className="text-forge-text">{agent.config.rebalanceThreshold}%</p>
                </div>
              )}
              {agent.config.floorAlertThreshold !== undefined && (
                <div>
                  <p className="text-xs text-forge-text-subtle">Floor alert threshold</p>
                  <p className="text-forge-text">{agent.config.floorAlertThreshold}%</p>
                </div>
              )}
            </div>
            {agent.config.customInstructions && (
              <div>
                <p className="text-xs text-forge-text-subtle">Custom instructions</p>
                <p className="mt-1 text-sm text-forge-text-muted">
                  {agent.config.customInstructions}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-forge-border bg-forge-surface p-5">
            <div>
              <p className="text-sm font-medium">
                {agent.status === 'paused' ? 'Agent paused' : 'Pause agent'}
              </p>
              <p className="text-xs text-forge-text-muted">
                Pausing stops scheduled runs. Your permission stays in place until you remove it.
              </p>
            </div>
            <Button variant={agent.status === 'paused' ? 'default' : 'outline'} size="sm">
              {agent.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
