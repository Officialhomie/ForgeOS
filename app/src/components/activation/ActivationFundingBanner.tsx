'use client'

import { Coins, RefreshCw } from 'lucide-react'
import { useActivationContext } from '@/providers/ActivationProvider'
import { useActivationFundingStatus } from '@/hooks/useActivationFundingStatus'
import { formatUsdc } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function ActivationFundingBanner() {
  const { isConnected, currentStep, phase } = useActivationContext()
  const { poolBalance, walletUsdc, loading, funded, refresh } =
    useActivationFundingStatus()

  if (!isConnected) return null

  const onFundStep = currentStep === 'fund' || currentStep === 'complete'
  const fundingBusy = phase === 'funding'

  const poolLabel =
    poolBalance === null ? (loading ? 'Loading…' : '—') : formatUsdc(poolBalance)
  const walletLabel =
    walletUsdc === null ? (loading ? 'Loading…' : '—') : formatUsdc(walletUsdc)

  return (
    <div
      className={cn(
        'mb-6 rounded-xl border px-4 py-3 text-sm',
        funded
          ? 'border-forge-success/30 bg-forge-success/5'
          : 'border-forge-orange/30 bg-forge-orange/5',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Coins
            className={cn(
              'mt-0.5 size-4 shrink-0',
              funded ? 'text-forge-success' : 'text-forge-orange',
            )}
          />
          <div>
            <p className="font-medium text-forge-text">
              {funded ? 'Spending pool is funded' : 'Spending pool needs funds'}
            </p>
            <p className="mt-1 text-xs text-forge-text-muted">
              In your spending pool:{' '}
              <span className="font-medium text-forge-text">{poolLabel}</span>
              {' · '}
              In your wallet:{' '}
              <span className="font-medium text-forge-text">{walletLabel}</span>
            </p>
            {!funded && !onFundStep && (
              <p className="mt-1 text-xs text-forge-text-subtle">
                Finish the steps above, then add funds in step 4 so your agents can pay for tasks.
              </p>
            )}
            {!funded && onFundStep && !fundingBusy && (
              <p className="mt-1 text-xs text-forge-text-subtle">
                Use the form below — MetaMask will ask you to approve USDC, then confirm the deposit.
              </p>
            )}
            {fundingBusy && (
              <p className="mt-1 text-xs text-forge-orange">
                Waiting for MetaMask — approve both prompts to finish funding.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || fundingBusy}
          className="inline-flex items-center gap-1 rounded-md border border-forge-border px-2 py-1 text-xs text-forge-text-subtle transition-colors hover:text-forge-text disabled:opacity-50"
          title="Refresh balances"
        >
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </div>
  )
}
