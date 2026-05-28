'use client'

import { useState } from 'react'
import { ActivityBarChart } from '@/components/treasury/ActivityBarChart'
import { RecentPaymentsTable } from '@/components/treasury/RecentPaymentsTable'
import { TopUpModal } from '@/components/treasury/TopUpModal'
import { TreasuryDonut } from '@/components/treasury/TreasuryDonut'
import { Button } from '@/components/ui/Button'
import { TokenAmount } from '@/components/ui/TokenAmount'
import { useTreasury } from '@/hooks/useTreasury'
import { isGraphEnabled } from '@/lib/graph/config'
import { formatUsdc } from '@/lib/utils'

export default function TreasuryPage() {
  const { treasury, loading, error, recentPayments, dailySpend, refetch } =
    useTreasury()
  const [topUpOpen, setTopUpOpen] = useState(false)

  const reserved =
    treasury && treasury.monthlyUsage.cap > treasury.monthlyUsage.spent
      ? treasury.monthlyUsage.cap - treasury.monthlyUsage.spent
      : 0n

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Money & Spending</h1>
          <p className="mt-1 text-sm text-forge-text-muted">
            How much your agents have spent, what&apos;s left, and where the money went
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button onClick={() => setTopUpOpen(true)}>Add funds</Button>
        </div>
      </div>

      {!isGraphEnabled() && (
        <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-4 py-2 text-sm text-forge-warning">
          Payment history isn&apos;t live yet — but your balance still updates in real time.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-forge-danger/40 bg-forge-danger/10 px-4 py-2 text-sm text-forge-danger">
          {error}
        </p>
      )}

      {loading || !treasury ? (
        <p className="text-forge-text-muted">Loading your balance…</p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-forge-border bg-forge-surface p-5 lg:col-span-1">
              <p className="text-sm text-forge-text-muted">Available to spend</p>
              <p className="mt-2 text-3xl font-bold">
                <TokenAmount amount={treasury.usdcBalance} />
              </p>
              <p className="mt-2 text-xs text-forge-text-subtle">
                Spent this month: {formatUsdc(treasury.monthlyUsage.spent)} /{' '}
                {formatUsdc(treasury.monthlyUsage.cap)} (
                {treasury.monthlyUsage.percentUsed.toFixed(1)}%)
              </p>
            </div>

            <div className="rounded-xl border border-forge-border bg-forge-surface p-5 lg:col-span-2">
              <h2 className="font-semibold">Where your money is</h2>
              <TreasuryDonut
                available={treasury.usdcBalance}
                spent={treasury.totalSpent}
                reserved={reserved}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
              <h2 className="font-semibold">Spending this month</h2>
              <div className="mt-4">
                <ActivityBarChart dailySpend={dailySpend} />
              </div>
            </div>

            <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
              <h2 className="font-semibold">How your earnings are split</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between text-forge-text-muted">
                  <span>You keep (80%)</span>
                  <span>{formatUsdc(treasury.earningsBreakdown.userShare)}</span>
                </li>
                <li className="flex justify-between text-forge-text-muted">
                  <span>Auto-refills your balance (15%)</span>
                  <span>
                    {formatUsdc(treasury.earningsBreakdown.treasuryShare)}
                  </span>
                </li>
                <li className="flex justify-between text-forge-text-muted">
                  <span>Platform fee (5%)</span>
                  <span>
                    {formatUsdc(treasury.earningsBreakdown.platformShare)}
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-forge-text-subtle">
                Your take-home: {formatUsdc(treasury.netProfit)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
            <h2 className="font-semibold">Recent payments</h2>
            <p className="mt-1 text-xs text-forge-text-muted">
              Payments your agents made to services and recipients
            </p>
            <div className="mt-4">
              <RecentPaymentsTable payments={recentPayments} />
            </div>
          </div>
        </>
      )}

      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  )
}

