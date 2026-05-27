'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useOsStore } from '@/stores/os.store'
import { loadActivationState } from '@/lib/activation/storage'

export function ActivationGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const osStatus = useOsStore((s) => s.osStatus)

  useEffect(() => {
    const saved = loadActivationState()
    const active = osStatus === 'active' || saved?.phase === 'active'
    if (!active) {
      router.replace('/activate')
    }
  }, [osStatus, router, pathname])

  if (osStatus !== 'active') {
    const saved = loadActivationState()
    if (saved?.phase !== 'active') {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-forge-text-muted">
          Redirecting to activation…
        </div>
      )
    }
  }

  return <>{children}</>
}
