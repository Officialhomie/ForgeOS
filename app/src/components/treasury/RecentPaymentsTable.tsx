'use client'

import Link from 'next/link'
import type { TreasuryPaymentRow } from '@/lib/graph/mappers'
import { explorerTxUrl, formatUsdc, timeAgo, truncateAddress } from '@/lib/utils'
import { FORGE_CHAIN_ID_EXPORT } from '@/lib/constants'

export function RecentPaymentsTable({
  payments,
}: {
  payments: TreasuryPaymentRow[]
}) {
  if (payments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-forge-text-muted">
        No payments indexed yet
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-forge-border text-xs text-forge-text-muted">
            <th className="pb-2 pr-4 font-medium">Payee</th>
            <th className="pb-2 pr-4 font-medium">Amount</th>
            <th className="pb-2 pr-4 font-medium">Agent</th>
            <th className="pb-2 pr-4 font-medium">When</th>
            <th className="pb-2 font-medium">Tx</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr
              key={p.id}
              className="border-b border-forge-border-subtle/60 text-forge-text"
            >
              <td className="py-3 pr-4 font-mono text-xs text-forge-mono">
                {truncateAddress(p.payee, 6)}
              </td>
              <td className="py-3 pr-4">{formatUsdc(p.amount)}</td>
              <td className="py-3 pr-4 text-forge-text-muted">
                {p.agentId ?? '—'}
              </td>
              <td className="py-3 pr-4 text-forge-text-muted">
                {timeAgo(p.timestamp)}
              </td>
              <td className="py-3">
                <Link
                  href={explorerTxUrl(p.txHash, FORGE_CHAIN_ID_EXPORT)}
                  target="_blank"
                  className="text-forge-orange hover:underline"
                >
                  {truncateAddress(p.txHash, 4)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
