'use client'

import { cn } from '@/lib/utils'
import type { Caveat } from '@/types'

// ─── DOT COLOR BY ENFORCER TYPE ───────────────────────────────────────────────

function CaveatDot({ enforcerName }: { enforcerName: string }) {
  const isValue =
    enforcerName === 'ERC20TransferAmountEnforcer' ||
    enforcerName === 'ValueLteEnforcer' ||
    enforcerName === 'ERC20BalanceChangeEnforcer'

  const isTime =
    enforcerName === 'TimestampEnforcer' || enforcerName === 'BlockNumberEnforcer'

  const isLimit =
    enforcerName === 'LimitedCallsEnforcer' || enforcerName === 'NonceEnforcer'

  const isTarget =
    enforcerName === 'AllowedTargetsEnforcer' ||
    enforcerName === 'AllowedMethodsEnforcer' ||
    enforcerName === 'AllowedCalldataEnforcer'

  return (
    <span
      className={cn(
        'mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full',
        isValue && 'bg-forge-orange',
        isTime && 'bg-blue-400',
        isLimit && 'bg-amber-400',
        isTarget && 'bg-purple-400',
        !isValue && !isTime && !isLimit && !isTarget && 'bg-forge-text-subtle',
      )}
    />
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function CaveatList({
  caveats,
  className,
}: {
  caveats: Caveat[]
  className?: string
}) {
  if (caveats.length === 0) {
    return <p className={cn('text-xs text-forge-text-subtle', className)}>No rules set</p>
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {caveats.map((c, i) => (
        <li key={`${c.enforcer}-${i}`} className="flex items-start gap-2">
          <CaveatDot enforcerName={c.enforcerName} />
          <div className="min-w-0">
            <p className="text-xs leading-snug text-forge-text">{c.humanReadable}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
