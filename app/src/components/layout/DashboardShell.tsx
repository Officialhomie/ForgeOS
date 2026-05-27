'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { CommandBarModal } from '@/components/CommandBarModal'
import { useActivityStream } from '@/hooks/useActivityStream'
import { SubDelegationInitializer } from '@/components/SubDelegationInitializer'
import { SubDelegationBanner } from '@/components/SubDelegationBanner'
import { ExpiryRenewalBanner } from '@/components/ExpiryRenewalBanner'
import type { ReactNode } from 'react'

export function DashboardShell({ children }: { children: ReactNode }) {
  // Subscribe to 1Shot webhook events via SSE — replaces all polling
  useActivityStream()

  return (
    <>
      <SubDelegationInitializer />
    <div className="flex min-h-screen bg-forge-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <ExpiryRenewalBanner />
          <SubDelegationBanner />
          {children}
        </main>
      </div>
      {/* Command palette — mounts once, registers global Cmd+K shortcut */}
      <CommandBarModal />
    </div>
    </>
  )
}
