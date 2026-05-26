import { ActivationGuard } from '@/components/guards/ActivationGuard'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { isDemoMode } from '@/lib/demo'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const demo = isDemoMode()

  return (
    <DashboardShell>
      {demo && (
        <div className="flex items-center justify-center gap-2 border-b border-forge-orange/20 bg-forge-orange/5 px-4 py-1.5 text-xs text-forge-orange">
          <span className="h-1.5 w-1.5 rounded-full bg-forge-orange" />
          Demo mode — mock data active. Set{' '}
          <code className="font-mono">NEXT_PUBLIC_DEMO_MODE=false</code>{' '}
          and connect MetaMask to go live.
        </div>
      )}
      <ActivationGuard>{children}</ActivationGuard>
    </DashboardShell>
  )
}
