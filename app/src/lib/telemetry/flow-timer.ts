/**
 * Lightweight per-request flow timer.
 *
 * Used in API routes to track how long each step takes end-to-end.
 * Results are returned in API responses under a `timing` key so the
 * dashboard can surface real latency numbers.
 *
 * Usage:
 *   const timer = createFlowTimer('command')
 *   timer.checkpoint('venice_start')
 *   await venice.parseIntent(intent)
 *   timer.checkpoint('venice_end')
 *   const timing = timer.end()
 *   // → { total: 3120, steps: { venice: 3100 }, checkpoints: [...] }
 */

export interface FlowTiming {
  /** Flow name (e.g. 'command', 'execute', 'relay') */
  flow: string
  /** Total elapsed ms from createFlowTimer() to end() */
  totalMs: number
  /** Per-step durations derived from checkpoint pairs (start/end naming convention) */
  steps: Record<string, number>
  /** Raw ordered checkpoints with timestamps */
  checkpoints: Array<{ name: string; elapsedMs: number }>
}

export interface FlowTimer {
  checkpoint(name: string): void
  end(): FlowTiming
}

export function createFlowTimer(flow: string): FlowTimer {
  const origin = Date.now()
  const checkpoints: Array<{ name: string; elapsedMs: number }> = []

  return {
    checkpoint(name: string) {
      checkpoints.push({ name, elapsedMs: Date.now() - origin })
    },

    end(): FlowTiming {
      const totalMs = Date.now() - origin

      // Derive step durations from paired _start / _end checkpoints
      const steps: Record<string, number> = {}
      const startMap = new Map<string, number>()

      for (const cp of checkpoints) {
        if (cp.name.endsWith('_start')) {
          const key = cp.name.slice(0, -6)
          startMap.set(key, cp.elapsedMs)
        } else if (cp.name.endsWith('_end')) {
          const key = cp.name.slice(0, -4)
          const start = startMap.get(key)
          if (start !== undefined) {
            steps[key] = cp.elapsedMs - start
          }
        }
      }

      return { flow, totalMs, steps, checkpoints }
    },
  }
}
