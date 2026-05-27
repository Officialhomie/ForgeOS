'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { cn, formatUsdc, truncateAddress, formatDate, timeAgo } from '@/lib/utils'
import { useSubscriptions, type SubscriptionDisplay } from '@/hooks/useSubscriptions'
import { useOsStore } from '@/stores/os.store'
import { CONTRACTS } from '@/lib/contracts'
import { EmptyState } from '@/components/ui/EmptyState'
import type { CreateSubscriptionParams } from '@/types'

// ─── SUBSCRIPTION CARD ────────────────────────────────────────────────────────

function SubscriptionCard({
  sub,
  onRunNow,
  onCancel,
  isRunning,
}: {
  sub: SubscriptionDisplay
  onRunNow: (sub: SubscriptionDisplay) => void
  onCancel: (sub: SubscriptionDisplay) => void
  isRunning: boolean
}) {
  const statusColor =
    sub.isExpired || sub.isComplete
      ? 'text-forge-text-subtle'
      : sub.status === 'active'
        ? 'text-forge-success'
        : 'text-forge-text-subtle'

  const statusLabel = sub.isComplete
    ? 'Complete'
    : sub.isExpired
      ? 'Expired'
      : sub.status === 'active'
        ? 'Active'
        : 'Paused'

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', statusColor)}>{statusLabel}</span>
            <span className="text-forge-text-subtle text-xs">·</span>
            <span className="text-xs text-forge-text-subtle font-mono">
              {truncateAddress(sub.delegation.hash, 4)}
            </span>
          </div>
          <h2 className="mt-0.5 text-base font-semibold text-forge-text">{sub.name}</h2>
          <p className="text-sm text-forge-text-muted">{sub.description}</p>
        </div>

        {/* Actions */}
        {sub.status === 'active' && !sub.isComplete && !sub.isExpired && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => onRunNow(sub)}
              disabled={isRunning}
              className={cn(
                'rounded-lg border border-forge-orange/40 bg-forge-orange/10 px-3 py-1.5 text-xs font-medium text-forge-orange transition-colors',
                isRunning
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-forge-orange/20',
              )}
            >
              {isRunning ? 'Running…' : 'Run Now'}
            </button>
            <button
              onClick={() => onCancel(sub)}
              className="rounded-lg border border-forge-border px-3 py-1.5 text-xs font-medium text-forge-text-subtle transition-colors hover:border-forge-danger/40 hover:text-forge-danger"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Payment details */}
      <div className="grid grid-cols-3 gap-4 rounded-lg bg-forge-elevated p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-forge-text-subtle">Amount</p>
          <p className="mt-0.5 text-sm font-semibold text-forge-text">
            {formatUsdc(sub.amount)}
          </p>
          <p className="text-[10px] text-forge-text-subtle">per cycle</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-forge-text-subtle">Recipient</p>
          <p className="mt-0.5 font-mono text-xs text-forge-text">
            {truncateAddress(sub.recipient, 4)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-forge-text-subtle">Next payment</p>
          <p className="mt-0.5 text-xs text-forge-text">
            {sub.isComplete || sub.isExpired
              ? '—'
              : sub.nextPaymentAt
                ? formatDate(sub.nextPaymentAt)
                : '—'}
          </p>
          {sub.lastPaymentAt && (
            <p className="text-[10px] text-forge-text-subtle">Last: {timeAgo(sub.lastPaymentAt)}</p>
          )}
        </div>
      </div>

      {/* Cycle progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-forge-text-subtle">
            {sub.cyclesUsed} of {sub.maxPayments} cycles used
          </span>
          <span className="text-forge-text-subtle">{sub.paymentsRemaining} remaining</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-forge-elevated">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              sub.cycleProgress >= 90 ? 'bg-forge-danger' : 'bg-forge-success',
            )}
            style={{ width: `${sub.cycleProgress}%` }}
          />
        </div>
      </div>

      {/* Timestamp enforcer window */}
      {sub.validAfter !== null && sub.validBefore !== null && (
        <div className="flex items-center gap-1.5 text-[10px] text-forge-text-subtle">
          <span className="rounded border border-forge-border px-1.5 py-0.5 font-mono">
            TimestampEnforcer
          </span>
          <span>
            {formatDate(sub.validAfter)} – {formatDate(sub.validBefore)}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── CREATE FORM ──────────────────────────────────────────────────────────────

function CreateSubscriptionForm({ onClose }: { onClose: () => void }) {
  const { address } = useAccount()
  const rootDelegation = useOsStore((s) => s.rootDelegation)

  const [fields, setFields] = useState<CreateSubscriptionParams>({
    name: '',
    description: '',
    recipient: '0x' as `0x${string}`,
    amount: 10_000_000n,
    frequencySeconds: 2592000,
    maxPayments: 12,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleChange(key: keyof CreateSubscriptionParams, value: string | number | bigint) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address || !rootDelegation) {
      setSubmitError('Wallet not connected or activation not complete.')
      return
    }
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          amount: fields.amount.toString(),
          durationSeconds: fields.frequencySeconds * fields.maxPayments,
          maxPayments: fields.maxPayments,
          parentDelegationHash: rootDelegation.hash,
          delegatorAddress: address,
          delegateAddress: CONTRACTS.osKernel,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Failed to create subscription')
      }
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create subscription')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-forge-orange/30 bg-forge-surface p-5">
      <h3 className="mb-4 text-sm font-semibold">New x402 Subscription</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] text-forge-text-subtle">Name</label>
            <input
              className="w-full rounded-lg border border-forge-border bg-forge-elevated px-3 py-2 text-sm text-forge-text placeholder-forge-text-subtle focus:border-forge-orange focus:outline-none"
              placeholder="Monthly Aave deposit"
              value={fields.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] text-forge-text-subtle">Recipient address</label>
            <input
              className="w-full rounded-lg border border-forge-border bg-forge-elevated px-3 py-2 font-mono text-xs text-forge-text placeholder-forge-text-subtle focus:border-forge-orange focus:outline-none"
              placeholder="0x..."
              value={fields.recipient}
              onChange={(e) => handleChange('recipient', e.target.value as `0x${string}`)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-forge-text-subtle">Amount per cycle (USDC)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="w-full rounded-lg border border-forge-border bg-forge-elevated px-3 py-2 text-sm text-forge-text focus:border-forge-orange focus:outline-none"
              value={Number(fields.amount) / 1_000_000}
              onChange={(e) => handleChange('amount', BigInt(Math.round(parseFloat(e.target.value) * 1_000_000)))}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-forge-text-subtle">Max payments</label>
            <input
              type="number"
              min="1"
              max="365"
              className="w-full rounded-lg border border-forge-border bg-forge-elevated px-3 py-2 text-sm text-forge-text focus:border-forge-orange focus:outline-none"
              value={fields.maxPayments}
              onChange={(e) => handleChange('maxPayments', parseInt(e.target.value, 10))}
            />
          </div>
        </div>

        <p className="text-[10px] text-forge-text-subtle">
          Creates a ERC-7710 delegation with TimestampEnforcer + ERC20TransferAmountEnforcer +
          LimitedCallsEnforcer. No new signature required per cycle.
        </p>

        {submitError && (
          <p className="rounded-lg bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">
            {submitError}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !address || !rootDelegation}
            className="flex-1 rounded-lg bg-forge-orange py-2 text-sm font-semibold text-black transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Creating…' : 'Create Subscription'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-forge-border px-4 py-2 text-sm text-forge-text-subtle transition-colors hover:text-forge-text"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const { subscriptions } = useSubscriptions()
  const [runningId, setRunningId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function handleRunNow(sub: SubscriptionDisplay) {
    setRunningId(sub.id)
    try {
      await fetch('/api/subscriptions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: { ...sub, amount: sub.amount.toString() },
        }),
      })
    } finally {
      setRunningId(null)
    }
  }

  async function handleCancel(sub: SubscriptionDisplay) {
    // Revoke the delegation — in live mode this calls the delegation revoke endpoint
    await fetch('/api/delegations/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delegationHash: sub.delegation.hash }),
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forge-text">Subscriptions</h1>
          <p className="mt-1 text-sm text-forge-text-muted">
            x402 recurring payments via ERC-7710 delegation — no signature per cycle
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg border border-forge-orange/40 bg-forge-orange/10 px-4 py-2 text-sm font-medium text-forge-orange transition-colors hover:bg-forge-orange/20"
        >
          {showCreate ? 'Close' : '+ New Subscription'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateSubscriptionForm onClose={() => setShowCreate(false)} />
      )}

      {/* Delegation policy legend */}
      <div className="flex flex-wrap gap-2">
        {['TimestampEnforcer', 'ERC20TransferAmountEnforcer', 'LimitedCallsEnforcer'].map((e) => (
          <span
            key={e}
            className="rounded-full border border-forge-border bg-forge-elevated px-2.5 py-1 text-[10px] text-forge-text-subtle"
          >
            {e}
          </span>
        ))}
      </div>

      {/* List */}
      {subscriptions.length === 0 ? (
        <EmptyState
          title="No subscriptions"
          description="Create a subscription to set up recurring x402 payments via ERC-7710 delegation. No new user signature is required per cycle."
        />
      ) : (
        <ul className="space-y-4">
          {subscriptions.map((sub) => (
            <li key={sub.id}>
              <SubscriptionCard
                sub={sub}
                onRunNow={handleRunNow}
                onCancel={handleCancel}
                isRunning={runningId === sub.id}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
