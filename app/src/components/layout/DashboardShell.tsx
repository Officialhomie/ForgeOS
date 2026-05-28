'use client'

import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { CommandBarModal } from '@/components/CommandBarModal'
import { useActivityStream } from '@/hooks/useActivityStream'
import { SubDelegationInitializer } from '@/components/SubDelegationInitializer'
import { SubDelegationBanner } from '@/components/SubDelegationBanner'
import { ExpiryRenewalBanner } from '@/components/ExpiryRenewalBanner'
import { useEffect, useState, type ReactNode } from 'react'

export function DashboardShell({ children }: { children: ReactNode }) {
  // Subscribe to 1Shot webhook events via SSE — replaces all polling
  useActivityStream()
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    if (!navOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [navOpen])

  return (
    <>
      <SubDelegationInitializer />
    <div className="flex min-h-screen bg-forge-bg">
      <div className="hidden sm:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenNav={() => setNavOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <ExpiryRenewalBanner />
          <SubDelegationBanner />
          {children}
        </main>
      </div>

      {navOpen && (
        <div
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
          <div className="relative h-full w-60 overflow-y-auto bg-forge-surface border-r border-forge-border">
            <div className="flex items-center justify-between border-b border-forge-border px-4 py-3">
              <span className="text-sm font-bold text-forge-orange">ForgeOS</span>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="rounded-md border border-forge-border bg-forge-bg px-2 py-1 text-xs text-forge-text-subtle"
              >
                Close
              </button>
            </div>
            <div className="h-[calc(100%-56px)]">
              <Sidebar />
            </div>
          </div>
        </div>
      )}
      {/* Command palette — mounts once, registers global Cmd+K shortcut */}
      <CommandBarModal />
    </div>
    </>
  )
}
