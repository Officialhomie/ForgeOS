'use client'

import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn, timeAgo, formatUsdc, explorerTxUrl } from '@/lib/utils'
import { FORGE_CHAIN_ID_EXPORT } from '@/lib/constants'
import type { AgentRun } from '@/types'

// ─── STATUS MAPPING ───────────────────────────────────────────────────────────

type BadgeVariant = 'active' | 'running' | 'paused' | 'error'

const STATUS_BADGE: Record<string, BadgeVariant> = {
  confirmed: 'active',
  pending: 'running',
  reasoning: 'running',
  planning: 'running',
  executing: 'running',
  failed: 'error',
  reverted: 'error',
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function RunHistoryTable({
  runs,
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: {
  runs: AgentRun[]
  page: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
}) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-forge-border bg-forge-surface p-8 text-center">
        <p className="text-sm text-forge-text-muted">No runs recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-forge-border bg-forge-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-forge-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-forge-text-subtle">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-forge-text-subtle">
                Trigger
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-forge-text-subtle">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-forge-text-subtle">
                Cost
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-forge-text-subtle">
                Tx
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr
                key={run.id}
                className={cn(
                  'border-b border-forge-border/40 last:border-0',
                  i % 2 === 1 && 'bg-forge-elevated/30',
                )}
              >
                <td className="px-4 py-3 text-forge-text-muted">{timeAgo(run.triggeredAt)}</td>
                <td className="px-4 py-3 capitalize text-forge-text-muted">{run.trigger}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    variant={STATUS_BADGE[run.status] ?? 'paused'}
                    label={run.status}
                  />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-forge-text-muted">
                  {run.cost > 0n ? formatUsdc(run.cost) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {run.userOps[0]?.txHash ? (
                    <a
                      href={explorerTxUrl(run.userOps[0].txHash, FORGE_CHAIN_ID_EXPORT)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-forge-orange hover:underline"
                    >
                      {run.userOps[0].txHash.slice(0, 10)}…
                    </a>
                  ) : (
                    <span className="text-forge-text-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-forge-text-subtle">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={onNext}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
