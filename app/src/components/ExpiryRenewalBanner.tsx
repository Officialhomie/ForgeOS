'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useOsStore } from '@/stores/os.store'

export function ExpiryRenewalBanner() {
  const root = useOsStore((s) => s.rootDelegation)
  const [nowSeconds, setNowSeconds] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const id = setInterval(() => {
      setNowSeconds(Math.floor(Date.now() / 1000))
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!root) return null

  const expiryCaveat = root.caveats.find((c) =>
    c.enforcerName.toLowerCase().includes('timestamp'),
  )
  const expiry =
    expiryCaveat?.decodedTerms &&
    typeof expiryCaveat.decodedTerms === 'object' &&
    'expiry' in expiryCaveat.decodedTerms
      ? Number((expiryCaveat.decodedTerms as { expiry: number }).expiry)
      : null

  const daysLeft = expiry ? Math.floor((expiry - nowSeconds) / 86400) : null

  if (daysLeft === null) return null
  if (daysLeft > 30) return null

  return (
    <div className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm">
      Your main permission grant expires in {daysLeft} days.{' '}
      <Link href="/activate" className="font-medium text-orange-300 underline">
        Renew permissions
      </Link>
    </div>
  )
}
