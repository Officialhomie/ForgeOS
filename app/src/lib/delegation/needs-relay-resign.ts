import { getRelayTargetAddress } from '@/lib/oneshot/client'
import { CONTRACTS } from '@/lib/contracts'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Delegation } from '@/types'

/** Root delegations signed before relay-target fix used OSKernel as delegate. */
export function hasLegacyKernelDelegate(root: Delegation | null): boolean {
  if (!root?.delegate) return false
  return root.delegate.toLowerCase() === CONTRACTS.osKernel.toLowerCase()
}

export async function rootDelegationNeedsRelayResign(
  root: Delegation | null,
  chainId: number = ACTIVATION_CHAIN_ID,
): Promise<boolean> {
  if (!root) return false
  const relayTarget = await getRelayTargetAddress(chainId)
  return root.delegate.toLowerCase() !== relayTarget.toLowerCase()
}
