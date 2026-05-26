'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/Button'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { revokeDelegation } from '@/lib/delegation/revoke'
import type { Delegation } from '@/types'

export function RevokeDelegationModal({
  delegation,
  onClose,
}: {
  delegation: Delegation
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRevoke() {
    setLoading(true)
    setError(null)
    try {
      await revokeDelegation(delegation.hash)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !loading) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-forge-border bg-forge-surface p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">Revoke Delegation</Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-forge-text-muted">
            This action is irreversible. All child sub-delegations rooted here will also be
            invalidated on-chain.
          </Dialog.Description>

          <div className="mt-4 space-y-2 rounded-xl border border-forge-border bg-forge-elevated p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-forge-text-subtle">From</span>
              <AddressDisplay address={delegation.delegator} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-xs text-forge-text-subtle">To</span>
              <AddressDisplay address={delegation.delegate} />
            </div>
            <div className="flex items-start gap-2">
              <span className="w-12 shrink-0 text-xs text-forge-text-subtle">Hash</span>
              <span className="break-all font-mono text-xs text-forge-text">
                {delegation.hash.slice(0, 26)}…
              </span>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-5 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={loading}>
              {loading ? 'Revoking…' : 'Revoke Delegation'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
