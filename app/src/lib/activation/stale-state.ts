import type { ActivationPersistedState } from '@/types/activation'
import type { Hash } from '@/types'

const MOCK_FUND_PREFIXES = ['0xFUND', '0xDEP000', '0xDEPLOY'] as const

export function isMockActivationTxHash(hash: Hash | undefined): boolean {
  if (!hash) return false
  return MOCK_FUND_PREFIXES.some((prefix) => hash.startsWith(prefix))
}

/** @deprecated Use isMockActivationTxHash */
export function isMockFundTxHash(hash: Hash | undefined): boolean {
  return isMockActivationTxHash(hash)
}

/** Demo / optimistic activation that never confirmed real treasury funding. */
export function isStaleActivationState(
  state: ActivationPersistedState | null,
): boolean {
  if (!state) return false
  if (state.oneShotTaskId?.startsWith('demo-')) return true
  if (isMockActivationTxHash(state.fundTxHash)) return true
  if (isMockActivationTxHash(state.deployTxHash)) return true
  if (state.phase === 'active' && !state.fundTxHash) return true
  return false
}

export function sanitizeStaleActivation(
  state: ActivationPersistedState,
): ActivationPersistedState {
  const completedSteps = state.completedSteps.filter(
    (step) => step !== 'fund' && step !== 'complete',
  )
  return {
    ...state,
    phase: 'idle',
    completedSteps,
    fundTxHash: undefined,
    oneShotTaskId: undefined,
    updatedAt: Date.now(),
  }
}
