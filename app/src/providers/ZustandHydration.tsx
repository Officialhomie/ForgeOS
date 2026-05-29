'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ensureStorageContractVersion } from '@/lib/persist/storage-reset'
import { hydrateDemoStores } from '@/stores/hydrate-demo'

export function ZustandHydration({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    ensureStorageContractVersion()
    hydrateDemoStores()
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-forge-bg text-forge-text-muted">
        Loading ForgeOS…
      </div>
    )
  }

  return <>{children}</>
}
