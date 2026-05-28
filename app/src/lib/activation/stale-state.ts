import type { Hash } from '@/types'

const MOCK_FUND_PREFIXES = ['0xFUND', '0xDEP000', '0xDEPLOY'] as const

export function isMockActivationTxHash(hash: Hash | string | undefined | null): boolean {
  if (!hash) return false
  return MOCK_FUND_PREFIXES.some((prefix) => hash.startsWith(prefix))
}

/** @deprecated Use isMockActivationTxHash */
export function isMockFundTxHash(hash: Hash | undefined): boolean {
  return isMockActivationTxHash(hash)
}

interface StaleCheckInput {
  phase?: string | null
  fundTxHash?: Hash | string | null
  deployTxHash?: Hash | string | null
  oneShotTaskId?: string | null
}

/** Demo / optimistic activation that never confirmed real treasury funding. */
export function isStaleActivationState(state: StaleCheckInput | null): boolean {
  if (!state) return false
  if (state.oneShotTaskId?.startsWith('demo-')) return true
  if (isMockActivationTxHash(state.fundTxHash)) return true
  if (isMockActivationTxHash(state.deployTxHash)) return true
  if (state.phase === 'active' && !state.fundTxHash) return true
  return false
}
