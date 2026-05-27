import type { ActivationPersistedState } from '@/types/activation'

const STORAGE_KEY = 'forgeos_activation_v1'

export function loadActivationState(): ActivationPersistedState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ActivationPersistedState
  } catch {
    return null
  }
}

export function saveActivationState(state: ActivationPersistedState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearActivationState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function loadRootDelegation(): import('@/types').Delegation | null {
  return loadActivationState()?.rootDelegation ?? null
}

export function saveDelegationsToActivation(patch: {
  rootDelegation?: import('@/types').Delegation
  subDelegation?: import('@/types').Delegation
  reDelegation?: import('@/types').Delegation
  delegationHash?: import('@/types').Hash
}): void {
  const prev = loadActivationState()
  saveActivationState({
    phase: prev?.phase ?? 'idle',
    completedSteps: prev?.completedSteps ?? [],
    updatedAt: Date.now(),
    ...prev,
    ...patch,
    delegationHash: patch.delegationHash ?? patch.rootDelegation?.hash ?? prev?.delegationHash,
  })
}
