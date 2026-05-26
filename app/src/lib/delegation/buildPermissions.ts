import type { PermissionRequestParameter } from '@metamask/smart-accounts-kit/actions'
import { CONTRACTS } from '@/lib/contracts'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Address } from '@/types'

const MONTH_SECONDS = 30 * 24 * 60 * 60

export function buildActivationPermissions(
  kernelAddress: Address = CONTRACTS.osKernel,
  options?: {
    monthlyCapUsdc?: number
    usdcAddress?: Address
  },
): PermissionRequestParameter[] {
  const monthlyCap = options?.monthlyCapUsdc ?? 500
  const tokenAddress = options?.usdcAddress ?? CONTRACTS.usdc
  const periodAmount = BigInt(monthlyCap) * 1_000_000n

  return [
    {
      chainId: ACTIVATION_CHAIN_ID,
      to: kernelAddress,
      permission: {
        type: 'erc20-token-periodic',
        isAdjustmentAllowed: false,
        data: {
          periodAmount,
          periodDuration: MONTH_SECONDS,
          tokenAddress,
          justification:
            'ForgeOS root delegation — monthly spend cap for all agents',
        },
      },
    },
  ]
}
