'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ensureStorageContractVersion } from '@/lib/persist/storage-reset'
import { hydrateDemoStores } from '@/stores/hydrate-demo'
import { ForgeMark } from '@/components/ui/ForgeMark'

export function ZustandHydration({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureStorageContractVersion()
    hydrateDemoStores()
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-forge-bg">
        <ForgeMark size={48} className="animate-pulse" />
        <span className="text-sm text-forge-text-muted">Loading…</span>
      </div>
    )
  }

  return <>{children}</>
}
