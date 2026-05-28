'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HealthService {
  status: string
  latencyMs: number | null
  detail?: string
}

interface HealthResponse {
  ok: boolean
  ready: boolean
  services: Record<string, HealthService>
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'Online',
  degraded: 'Slow',
  error: 'Offline',
  unconfigured: 'Not set up',
}

const SERVICE_LABELS: Record<string, string> = {
  venice: 'AI brain',
  oneshot: 'Transaction sender',
  chain: 'Blockchain network',
  wallet: 'Agent wallet',
  subgraph: 'Payment history',
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d as HealthResponse))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Is everything working?</h1>
        <p className="mt-1 text-sm text-forge-text-muted">
          A quick check on all the services ForgeOS relies on to run smoothly.
        </p>
      </div>

      {loading && <p className="text-sm text-forge-text-muted">Running checks…</p>}

      {health && (
        <div className="space-y-3">
          <p className="text-sm">
            Overall:{' '}
            <span className={health.ready ? 'text-green-400' : 'text-amber-400'}>
              {health.ready ? 'Everything looks good!' : 'There are a few issues'}
            </span>
          </p>
          <ul className="divide-y divide-forge-border rounded-lg border border-forge-border">
            {Object.entries(health.services).map(([name, svc]) => (
              <li key={name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{SERVICE_LABELS[name] ?? name}</span>
                <span className="text-forge-text-muted">
                  {STATUS_LABELS[svc.status] ?? svc.status}
                  {svc.latencyMs != null ? ` · ${svc.latencyMs}ms` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/dashboard"
        className="inline-flex h-8 items-center rounded-lg bg-secondary px-3 text-sm"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
