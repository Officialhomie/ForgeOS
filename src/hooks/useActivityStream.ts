'use client'

import { useEffect } from 'react'
import { isDemoMode } from '@/lib/demo'
import { useActivityStore } from '@/stores/activity.store'
import type { ActivityEvent, OneShotTask } from '@/types'

/**
 * Subscribes to /api/events (SSE) in live mode.
 * Pushes incoming ActivityEvents into the Zustand activity store.
 * No-op in demo mode (mock data is pre-loaded by hydrate-demo).
 *
 * Mount once in dashboard/layout.tsx — EventSource auto-reconnects on error.
 */
export function useActivityStream() {
  const pushActivity = useActivityStore((s) => s.pushActivity)

  useEffect(() => {
    if (isDemoMode()) return

    const es = new EventSource('/api/events')

    es.addEventListener('activity', (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as ActivityEvent
        pushActivity(event)
      } catch {
        // ignore malformed events
      }
    })

    es.addEventListener('task', (e: MessageEvent<string>) => {
      try {
        const task = JSON.parse(e.data) as OneShotTask
        // Surface confirmed/rejected task as an activity event
        if (task.status === 'Confirmed' || task.status === 'Rejected') {
          const activity: ActivityEvent = {
            id: `task_${task.taskId}_${task.status}`,
            type: task.status === 'Confirmed' ? 'agent_run_confirmed' : 'agent_run_failed',
            agentId: null,
            title: task.status === 'Confirmed' ? 'Transaction confirmed' : 'Transaction rejected',
            description: task.txHash
              ? `tx: ${task.txHash.slice(0, 18)}…`
              : task.failureReason ?? task.taskId,
            amount: null,
            txHash: task.txHash,
            delegationHash: null,
            timestamp: task.confirmedAt ?? Math.floor(Date.now() / 1000),
            status: task.status === 'Confirmed' ? 'confirmed' : 'failed',
          }
          pushActivity(activity)
        }
      } catch {
        // ignore
      }
    })

    es.onerror = () => {
      // EventSource will automatically try to reconnect after errors.
      // No manual intervention needed.
    }

    return () => {
      es.close()
    }
  }, [pushActivity])
}
