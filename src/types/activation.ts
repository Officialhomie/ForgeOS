import type { Address, Hash, ChainId } from '@/types'

export type ActivationStepId =
  | 'connect'
  | 'deploy'
  | 'permissions'
  | 'fund'
  | 'complete'

export type ActivationPhase =
  | 'idle'
  | 'connecting'
  | 'deploying'
  | 'requesting_permissions'
  | 'funding'
  | 'active'
  | 'error'

export interface ActivationStepState {
  id: ActivationStepId
  title: string
  description: string
  status: 'pending' | 'current' | 'complete' | 'error'
  error?: string
}

export interface ActivationPersistedState {
  phase: ActivationPhase
  completedSteps: ActivationStepId[]
  smartAccountAddress?: Address
  kernelAddress?: Address
  treasuryAddress?: Address
  delegationHash?: Hash
  deployTxHash?: Hash
  fundTxHash?: Hash
  oneShotTaskId?: string
  updatedAt: number
}

export interface ActivationPolicyPreview {
  monthlySpendCapUsdc: string
  maxSingleTxUsdc: string
  expiryLabel: string
  caveats: string[]
}

export const DEFAULT_POLICY_PREVIEW: ActivationPolicyPreview = {
  monthlySpendCapUsdc: '500',
  maxSingleTxUsdc: '200',
  expiryLabel: '30 days from activation',
  caveats: [
    'AllowedMethodsEnforcer: executeAction, redelegate',
    'ERC20TransferAmountEnforcer: max 500 USDC / month',
    'TimestampEnforcer: valid for 30 days',
    'AllowedTargetsEnforcer: approved DeFi + payment contracts',
  ],
}

export const ACTIVATION_CHAIN_SEPOLIA = 11155111 satisfies ChainId
export const ACTIVATION_CHAIN_BASE = 8453 satisfies ChainId
