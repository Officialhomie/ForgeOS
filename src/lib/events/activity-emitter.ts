/**
 * Server-side event emitter that bridges:
 *   webhook handler ──emit──► SSE endpoint ──stream──► browser clients
 *
 * Module singleton — lives in Node.js module cache across all route handlers.
 */

import { EventEmitter } from 'events'
import type { ActivityEvent, OneShotTask } from '@/types'

type EmitterEvents = {
  activity: [event: ActivityEvent]
  task: [task: OneShotTask]
}

class ActivityEmitter extends EventEmitter {
  emitActivity(event: ActivityEvent): void {
    this.emit('activity', event)
  }

  emitTask(task: OneShotTask): void {
    this.emit('task', task)
  }

  onActivity(listener: (event: ActivityEvent) => void): this {
    return this.on('activity', listener)
  }

  onTask(listener: (task: OneShotTask) => void): this {
    return this.on('task', listener)
  }

  offActivity(listener: (event: ActivityEvent) => void): this {
    return this.off('activity', listener)
  }

  offTask(listener: (task: OneShotTask) => void): this {
    return this.off('task', listener)
  }
}

export const activityEmitter = new ActivityEmitter()
// Prevent memory leak warnings for many concurrent SSE clients.
activityEmitter.setMaxListeners(200)
