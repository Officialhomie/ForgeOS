import { isDemoMode } from '@/lib/demo'
import { useDelegationsStore } from '@/stores/delegations.store'
import type { Hash } from '@/types'

/**
 * Revokes a delegation by hash.
 * Demo mode: optimistic update in Zustand store.
 * Live mode: POST to /api/relay/revoke → 1Shot relay.
 */
export async function revokeDelegation(delegationHash: Hash): Promise<void> {
  if (isDemoMode()) {
    const { delegations, setDelegations } = useDelegationsStore.getState()
    const updated = delegations.map((d) =>
      d.hash === delegationHash ? { ...d, status: 'revoked' as const } : d,
    )
    setDelegations(updated)
    return
  }

  const res = await fetch('/api/relay/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delegationHash }),
  })

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Revoke failed (${res.status})`)
  }
}
