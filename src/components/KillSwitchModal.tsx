'use client'

/**
 * P12.2 — Kill Switch Modal
 *
 * Always triggered by the red Kill Switch button in TopBar.
 * Shows active delegation count, then executes OSKernel.revokeAll() on confirm.
 *
 * Three states:
 *  - confirm  → show count + red confirm button
 *  - pending  → spinner, waiting for 1Shot webhook
 *  - revoked  → success screen, all agents stopped
 */

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useKillSwitch } from '@/hooks/useKillSwitch'

interface KillSwitchModalProps {
  onClose: () => void
}

export function KillSwitchModal({ onClose }: KillSwitchModalProps) {
  const { isPending, isRevoked, error, activeDelegationCount, revokeAll, reset } = useKillSwitch()

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPending, onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-forge-danger/40 bg-forge-surface p-6 shadow-2xl">
        {isRevoked ? (
          /* ── Success state ── */
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-forge-success bg-forge-success/15">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10l4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-forge-success"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-forge-text">All agents stopped</h2>
              <p className="mt-1 text-sm text-forge-text-muted">
                All delegations have been atomically revoked. No further agent actions can
                execute until you re-activate via the Activation Wizard.
              </p>
            </div>
            <button
              onClick={() => { reset(); onClose() }}
              className="w-full rounded-lg border border-forge-border py-2.5 text-sm font-medium text-forge-text transition-colors hover:bg-forge-elevated"
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Confirm state ── */
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-forge-danger bg-forge-danger/15">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 3v6M9 13h.01"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="text-forge-danger"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-forge-text">Emergency Kill Switch</h2>
                <p className="mt-0.5 text-sm text-forge-text-muted">
                  This will atomically revoke all agent permissions in a single transaction.
                </p>
              </div>
            </div>

            {/* Active delegation count */}
            <div className="rounded-lg border border-forge-danger/20 bg-forge-danger/5 px-4 py-3">
              <p className="text-sm text-forge-text">
                <span className="font-semibold text-forge-danger">{activeDelegationCount}</span>{' '}
                active delegation{activeDelegationCount !== 1 ? 's' : ''} will be revoked
              </p>
              <p className="mt-0.5 text-xs text-forge-text-subtle">
                OSKernel.revokeAll() via 1Shot relay · AllDelegationsRevoked event emitted
              </p>
            </div>

            {/* Warning */}
            <ul className="space-y-1 text-xs text-forge-text-subtle">
              <li className="flex gap-2">
                <span className="text-forge-danger">·</span>
                All scheduled agent runs will stop immediately
              </li>
              <li className="flex gap-2">
                <span className="text-forge-danger">·</span>
                Active subscriptions will be cancelled
              </li>
              <li className="flex gap-2">
                <span className="text-forge-danger">·</span>
                Re-activation requires going through the Activation Wizard again
              </li>
            </ul>

            {error && (
              <p className="rounded-lg bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isPending}
                className="flex-1 rounded-lg border border-forge-border py-2.5 text-sm font-medium text-forge-text-subtle transition-colors hover:text-forge-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={revokeAll}
                disabled={isPending}
                className={cn(
                  'flex-1 rounded-lg bg-forge-danger py-2.5 text-sm font-semibold text-white transition-opacity',
                  isPending ? 'cursor-not-allowed opacity-70' : 'hover:opacity-90',
                )}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Revoking…
                  </span>
                ) : (
                  'Revoke All Delegations'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
