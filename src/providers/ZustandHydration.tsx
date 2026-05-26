'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { hydrateDemoStores } from '@/stores/hydrate-demo'

export function ZustandHydration({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
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
