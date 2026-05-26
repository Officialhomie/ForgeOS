/**
 * Server-side in-memory task store for 1Shot relay tasks.
 *
 * Lives as a module singleton in the Node.js process.
 * Webhook handler writes here; SSE endpoint reads and forwards to clients.
 *
 * For production: replace with Redis or a database.
 */

import type { OneShotTask, OneShotTaskStatus, Hash } from '@/types'

class TaskStore {
  private readonly tasks = new Map<string, OneShotTask>()

  /** Register a new pending task immediately after 1Shot submission. */
  create(taskId: string): OneShotTask {
    const task: OneShotTask = {
      taskId,
      status: 'Pending',
      txHash: null,
      submittedAt: Math.floor(Date.now() / 1000),
      confirmedAt: null,
      failureReason: null,
    }
    this.tasks.set(taskId, task)
    return task
  }

  /** Update task status from 1Shot webhook payload. */
  update(
    taskId: string,
    status: OneShotTaskStatus,
    txHash?: Hash,
    failureReason?: string,
  ): OneShotTask | null {
    const existing = this.tasks.get(taskId)
    if (!existing) return null

    const updated: OneShotTask = {
      ...existing,
      status,
      txHash: txHash ?? existing.txHash,
      confirmedAt:
        status === 'Confirmed' ? Math.floor(Date.now() / 1000) : existing.confirmedAt,
      failureReason: failureReason ?? existing.failureReason,
    }

    this.tasks.set(taskId, updated)
    return updated
  }

  get(taskId: string): OneShotTask | null {
    return this.tasks.get(taskId) ?? null
  }

  /** Retrieve all tasks (for debug/admin). */
  getAll(): OneShotTask[] {
    return Array.from(this.tasks.values())
  }

  /** Prune tasks older than maxAgeSeconds to prevent unbounded growth. */
  prune(maxAgeSeconds = 3600): void {
    const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds
    for (const [id, task] of this.tasks) {
      if (task.submittedAt < cutoff) {
        this.tasks.delete(id)
      }
    }
  }
}

// Single instance shared across all API route invocations in this process.
export const taskStore = new TaskStore()
