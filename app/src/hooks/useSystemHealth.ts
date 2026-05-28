'use client'

import { useState, useEffect, useCallback } from 'react'
import type { HealthResponse } from '@/app/api/health/route'

const POLL_INTERVAL_MS = 30_000 // refresh every 30s

export type { HealthResponse }
export type { ServiceHealth, ServiceStatus } from '@/app/api/health/route'

export interface SystemHealthState {
  health: HealthResponse | null
  loading: boolean
  error: string | null
  /** Force an immediate re-check */
  refresh: () => void
}

export function useSystemHealth(): SystemHealthState {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    fetch('/api/health')
      .then(async (res) => {
        const data = (await res.json()) as HealthResponse
        setHealth(data)
        setError(null)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Health check failed')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { health, loading, error, refresh }
}
