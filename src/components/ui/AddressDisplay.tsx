'use client'

import { truncateAddress } from '@/lib/utils'
import { CopyButton } from '@/components/ui/CopyButton'

export function AddressDisplay({
  address,
  className,
}: {
  address: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs text-forge-mono ${className ?? ''}`}>
      {truncateAddress(address)}
      <CopyButton value={address} />
    </span>
  )
}
