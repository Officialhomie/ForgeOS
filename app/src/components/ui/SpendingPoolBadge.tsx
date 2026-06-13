'use client'

import Link from 'next/link'
import { useUserSpendingPool } from '@/hooks/useUserSpendingPool'
import { cn } from '@/lib/utils'

export function SpendingPoolBadge({ className }: { className?: string }) {
  const { label, funded, loading } = useUserSpendingPool()

  return (
    <Link
      href="/dashboard/treasury"
      className={cn(
        'hidden rounded-full border px-2.5 py-0.5 text-xs transition-colors sm:inline-flex',
        funded
          ? 'border-forge-success/30 bg-forge-success/10 text-forge-success hover:border-forge-success/50'
          : 'border-forge-warning/30 bg-forge-warning/10 text-amber-300 hover:border-forge-warning/50',
        className,
      )}
      title="View your spending pool"
    >
      {loading ? 'Pool …' : funded ? `Pool ${label}` : 'Add funds'}
    </Link>
  )
}
