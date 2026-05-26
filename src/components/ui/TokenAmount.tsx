import { formatUsdc } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function TokenAmount({
  amount,
  className,
}: {
  amount: bigint
  className?: string
}) {
  return (
    <span className={cn('tabular-nums text-sm font-medium', className)}>
      {formatUsdc(amount)}
    </span>
  )
}
