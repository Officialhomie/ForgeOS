'use client'

/**
 * SubDelegationInitializer
 *
 * Mounts useSubDelegations on dashboard load to auto-create the 2-hop
 * A2A delegation chain (OSKernel → DeFiAgent → PaymentAgent).
 * Renders nothing — side-effect only.
 */

import { useSubDelegations } from '@/hooks/useSubDelegations'

export function SubDelegationInitializer() {
  useSubDelegations()
  return null
}
