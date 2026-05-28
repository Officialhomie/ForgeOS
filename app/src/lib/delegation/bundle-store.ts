/**
 * Server-side delegation bundle store for cron / agents/run.
 * In-memory per deployment; use Vercel KV in production for multi-instance.
 */

import type { Address, Delegation } from '@/types'

const bundles = new Map<string, Delegation[]>()

function key(address: string): string {
  return address.toLowerCase()
}

export function setDelegationBundle(
  smartAccountAddress: Address,
  delegations: Delegation[],
): void {
  bundles.set(key(smartAccountAddress), delegations)
}

export function getDelegationBundle(smartAccountAddress: Address): Delegation[] | null {
  return bundles.get(key(smartAccountAddress)) ?? null
}

export function clearDelegationBundle(smartAccountAddress: Address): void {
  bundles.delete(key(smartAccountAddress))
}
