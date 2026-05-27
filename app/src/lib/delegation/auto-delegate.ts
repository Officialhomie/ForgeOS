/**
 * auto-delegate.ts
 *
 * Creates the 2-hop A2A sub-delegation chain automatically after OS activation.
 *
 *   Root delegation (user → OSKernel) [already exists after Step 3]
 *      └── Sub-delegation (OSKernel → DeFiAgent)    [created here, hop 1]
 *              └── Re-delegation (DeFiAgent → PaymentAgent) [created here, hop 2]
 *
 * These delegations are created deterministically from the root delegation.
 * No new user wallet signature is required — the OSKernel creates them.
 *
 * Track evidence:
 *  - Best A2A Coordination: 2-hop redelegation chain exists before command fires
 *  - Best Agent: delegation tree auto-initialized, user only approves once
 */

import type { Address, Delegation, Hash } from '@/types'
import {
  createSubDelegationStruct,
  createReDelegationStruct,
  subDelegationToForge,
} from '@/lib/delegation/createSubDelegation'

// ─── RESULT SHAPE ─────────────────────────────────────────────────────────────

export interface OSSubDelegations {
  subDelegation: Delegation
  subHash: Hash
  reDelegation: Delegation
  reHash: Hash
}

// ─── AUTO-CREATE ───────────────────────────────────────────────────────────────

/**
 * Creates the full 2-hop A2A delegation chain from the root delegation.
 *
 * @param rootDelegation - Signed root delegation (user → OSKernel) from os.store
 * @param defiAgentAddress - OSKernel → DeFiAgent (hop 1 delegate)
 * @param paymentAgentAddress - DeFiAgent → PaymentAgent (hop 2 delegate)
 */
export async function createOSSubDelegations(
  rootDelegation: Delegation,
  defiAgentAddress: Address,
  paymentAgentAddress: Address,
): Promise<OSSubDelegations> {
  const osKernelAddress = rootDelegation.delegate

  // Hop 1: OSKernel → DeFiAgent
  // Narrows root delegation: 500 USDC max, only executeAction/redelegate methods
  const { delegation: subKit, hash: subHash } = await createSubDelegationStruct({
    delegator: osKernelAddress,
    delegate: defiAgentAddress,
    parentDelegationHash: rootDelegation.hash,
  })

  const subDelegation = subDelegationToForge(
    subKit,
    subHash,
    'sub',
    'defi-rebalancer',
    rootDelegation.hash,
  )

  // Hop 2: DeFiAgent → PaymentAgent
  // Narrows sub-delegation: 100 USDC max, 1 call limit
  const { delegation: reKit, hash: reHash } = await createReDelegationStruct({
    delegator: defiAgentAddress,
    delegate: paymentAgentAddress,
    parentDelegationHash: subHash,
  })

  const reDelegation = subDelegationToForge(
    reKit,
    reHash,
    'redelegation',
    'payment-executor',
    subHash,
  )

  return { subDelegation, subHash, reDelegation, reHash }
}
