import type { Delegation } from '@/types'

const revokeSnapshots = new Map<string, Delegation[]>()

export function registerKillSwitchTask(taskId: string, delegations: Delegation[]): void {
  revokeSnapshots.set(taskId, delegations)
}

export function takeKillSwitchSnapshot(taskId: string): Delegation[] | null {
  const snap = revokeSnapshots.get(taskId) ?? null
  revokeSnapshots.delete(taskId)
  return snap
}

export function isKillSwitchTask(taskId: string): boolean {
  return revokeSnapshots.has(taskId)
}
