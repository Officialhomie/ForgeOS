'use client'

import { useSystemHealth } from '@/hooks/useSystemHealth'
import type { ServiceHealth } from '@/app/api/health/route'
import { Tooltip } from '@/components/ui/Tooltip'

// ─── DOT ──────────────────────────────────────────────────────────────────────

const DOT: Record<string, string> = {
  ok:            'bg-green-500',
  degraded:      'bg-yellow-400',
  error:         'bg-red-500 animate-pulse',
  unconfigured:  'bg-zinc-600',
}

const LABEL: Record<string, string> = {
  ok:            'ok',
  degraded:      'slow',
  error:         'down',
  unconfigured:  'not set',
}

function ServiceDot({ name, health }: { name: string; health: ServiceHealth }) {
  const dot = DOT[health.status] ?? DOT.error
  const badge = LABEL[health.status] ?? health.status
  const latency = health.latencyMs !== null ? `${health.latencyMs}ms` : null
  const tip = [
    health.detail ?? '',
    latency ? `Response time: ${latency}` : '',
  ].filter(Boolean).join(' · ') || health.status

  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="text-xs text-forge-text-muted">{name}</span>
      <span className={`text-xs ${health.status === 'error' ? 'text-red-400' : health.status === 'degraded' ? 'text-yellow-400' : 'text-forge-text-subtle'}`}>
        {badge}
        {latency && health.status === 'ok' && (
          <span className="ml-0.5 opacity-60">{latency}</span>
        )}
      </span>
      <Tooltip content={tip} side="bottom" />
    </span>
  )
}

// ─── BAR ──────────────────────────────────────────────────────────────────────

/**
 * Thin status bar showing live health of Venice, 1Shot, and the chain RPC.
 * Polls every 30s. Drop into any layout that should surface system status.
 */
export function SystemHealthBar({ className = '' }: { className?: string }) {
  const { health, loading, refresh } = useSystemHealth()

  if (loading && !health) {
    return (
      <div className={`flex items-center gap-1 text-xs text-forge-text-subtle ${className}`}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
        Checking services…
      </div>
    )
  }

  if (!health) return null

  const { services } = health

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <ServiceDot name="AI service" health={services.venice} />
      <ServiceDot name="Transaction relay" health={services.oneshot} />
      <ServiceDot name="Network" health={services.chain} />
      <ServiceDot name="Agent wallet" health={services.wallet} />
      <ServiceDot name="History index" health={services.subgraph} />
      <button
        onClick={refresh}
        className="ml-auto text-xs text-forge-text-subtle hover:text-forge-text transition-colors"
        title="Refresh health status"
      >
        ↻
      </button>
    </div>
  )
}
