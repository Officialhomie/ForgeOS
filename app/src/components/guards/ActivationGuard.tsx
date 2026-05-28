'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useOsStore } from '@/stores/os.store'
import { useActivationStore } from '@/stores/activation.store'
import { readTreasuryBalance } from '@/lib/treasury/onchain'

export function ActivationGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const osStatus = useOsStore((s) => s.osStatus)
  const setOsStatus = useOsStore((s) => s.setOsStatus)
  const [resolved, setResolved] = useState(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveActivation = async () => {
      const storedPhase = useActivationStore.getState().phase

      if (osStatus === 'active' || storedPhase === 'active') {
        setOsStatus('active')
        if (!cancelled) {
          setActive(true)
          setResolved(true)
        }
        return
      }

      const treasuryBalance = await readTreasuryBalance()
      const hasExistingFunds = typeof treasuryBalance === 'bigint' && treasuryBalance > 0n
      if (hasExistingFunds) {
        // Existing funded treasury should not force full re-activation UX.
        setOsStatus('active')
        if (!cancelled) {
          setActive(true)
          setResolved(true)
        }
        return
      }

      if (!cancelled) {
        setActive(false)
        setResolved(true)
      }
    }

    void resolveActivation()
    return () => {
      cancelled = true
    }
  }, [osStatus, setOsStatus, pathname])

  useEffect(() => {
    if (!resolved) return
    if (!active) router.replace('/activate')
  }, [active, resolved, router])

  if (!resolved || !active) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-forge-text-muted">
        Checking your account…
      </div>
    )
  }

  return <>{children}</>
}
