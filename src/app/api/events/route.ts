/**
 * GET /api/events
 *
 * Server-Sent Events (SSE) stream for live dashboard updates.
 * Replaces all polling — the frontend subscribes once and receives
 * push events as 1Shot webhooks are processed.
 *
 * Event types emitted:
 *  - "activity": ActivityEvent (agent runs, payments, delegations)
 *  - "task":     OneShotTask   (relay status updates)
 *  - comment:    ": ping"      (keep-alive every 15 s)
 */

import { activityEmitter } from '@/lib/events/activity-emitter'
import type { ActivityEvent, OneShotTask } from '@/types'

// Force Node.js runtime — SSE requires streaming response body support.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(type: string, data: ActivityEvent | OneShotTask) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          // Controller may already be closed (client disconnected)
        }
      }

      function sendPing() {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          /* closed */
        }
      }

      const onActivity = (event: ActivityEvent) => sendEvent('activity', event)
      const onTask = (task: OneShotTask) => sendEvent('task', task)

      activityEmitter.onActivity(onActivity)
      activityEmitter.onTask(onTask)

      // Keep-alive every 15 s to prevent proxy / load balancer timeouts.
      const pingInterval = setInterval(sendPing, 15_000)

      // Send initial ping so the client knows the connection is alive.
      sendPing()

      // Cleanup when client disconnects.
      request.signal.addEventListener('abort', () => {
        activityEmitter.offActivity(onActivity)
        activityEmitter.offTask(onTask)
        clearInterval(pingInterval)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering for SSE
    },
  })
}
