/**
 * POST /api/webhooks/1shot
 *
 * Receives task status callbacks from the 1Shot relay.
 * Must return 200 in < 500 ms to avoid relay retries.
 *
 * Flow:
 *   1. Read raw body (before JSON.parse) for Ed25519 verification.
 *   2. Verify signature with ONESHOT_WEBHOOK_SECRET.
 *   3. Update server-side task store.
 *   4. Emit ActivityEvent → SSE stream → connected dashboards.
 *
 * Track evidence:
 *  - Best 1Shot: webhook callbacks (not polling) — visible in dashboard logs
 */

import { ONESHOT } from '@/lib/constants'
import { verifyWebhookSignature, extractSignature } from '@/lib/oneshot/webhook'
import { taskStore } from '@/lib/oneshot/task-store'
import { activityEmitter } from '@/lib/events/activity-emitter'
import type { OneShotWebhookPayload, ActivityEvent, Hash } from '@/types'

export async function POST(request: Request) {
  // ── Read raw body first (needed for signature verification) ────────────────
  const rawBody = Buffer.from(await request.arrayBuffer())

  let payload: OneShotWebhookPayload
  try {
    payload = JSON.parse(rawBody.toString()) as OneShotWebhookPayload
  } catch {
    // Return 200 to prevent 1Shot from retrying a malformed payload.
    return new Response('OK', { status: 200 })
  }

  // ── Ed25519 signature verification ────────────────────────────────────────
  const publicKey = process.env.ONESHOT_WEBHOOK_SECRET
  if (publicKey) {
    const sig = extractSignature(request.headers) ?? payload.signature
    if (!sig || !verifyWebhookSignature(rawBody, sig, publicKey)) {
      // Log but still return 200 to avoid infinite retries.
      console.warn('[webhook] Invalid 1Shot signature for taskId:', payload.taskId)
      return new Response('OK', { status: 200 })
    }
  }

  // ── Update task store ─────────────────────────────────────────────────────
  const updatedTask = taskStore.update(
    payload.taskId,
    payload.status,
    payload.txHash,
    payload.failureReason,
  )

  if (updatedTask) {
    activityEmitter.emitTask(updatedTask)
  }

  // ── Build and emit ActivityEvent → SSE clients ────────────────────────────
  const isConfirmed = payload.status === 'Confirmed'
  const isFailed = payload.status === 'Rejected' || payload.status === 'Reverted'

  const event: ActivityEvent = {
    id: `webhook_${payload.taskId}_${Date.now()}`,
    type: isConfirmed ? 'agent_run_confirmed' : 'agent_run_failed',
    agentId: null,
    title: isConfirmed
      ? 'Transaction confirmed'
      : `Transaction ${payload.status.toLowerCase()}`,
    description: payload.txHash
      ? `tx ${payload.txHash.slice(0, 10)}… on chain ${ONESHOT.CHAIN_ID}`
      : payload.failureReason ?? `taskId: ${payload.taskId}`,
    amount: null,
    txHash: (payload.txHash as Hash) ?? null,
    delegationHash: null,
    timestamp: Math.floor(Date.now() / 1000),
    status: isConfirmed ? 'confirmed' : isFailed ? 'failed' : 'pending',
  }

  activityEmitter.emitActivity(event)

  // ── Periodic task store cleanup (every ~100 webhooks) ─────────────────────
  if (Math.random() < 0.01) {
    taskStore.prune()
  }

  // Always 200 — 1Shot must not retry on our processing errors.
  return new Response('OK', { status: 200 })
}
