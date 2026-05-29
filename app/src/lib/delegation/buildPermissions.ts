import type { PermissionRequestParameter } from '@metamask/smart-accounts-kit/actions'
import { CONTRACTS } from '@/lib/contracts'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Address } from '@/types'

const MONTH_SECONDS = 30 * 24 * 60 * 60

export function buildActivationPermissions(
  /** ERC-7715 permission target — must match 1Shot relayer `targetAddress`, not OSKernel. */
  permissionTarget: Address,
  options?: {
    monthlyCapUsdc?: number
    usdcAddress?: Address
  },
): PermissionRequestParameter[] {
  const monthlyCap = options?.monthlyCapUsdc ?? 500
  const tokenAddress = options?.usdcAddress ?? CONTRACTS.usdc
  // MetaMask RPC cannot serialize BigInt in permission params.
  const periodAmount = monthlyCap * 1_000_000

  return [
    {
      chainId: ACTIVATION_CHAIN_ID,
      to: permissionTarget,
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
