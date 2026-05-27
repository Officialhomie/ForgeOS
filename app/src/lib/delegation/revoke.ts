import type { Hash } from '@/types'

/**
 * Revokes a delegation by hash via POST to /api/relay/revoke → 1Shot relay.
 */
export async function revokeDelegation(delegationHash: Hash): Promise<void> {
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
