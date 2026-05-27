import { ActivationGuard } from '@/components/guards/ActivationGuard'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardShell>
      <ActivationGuard>{children}</ActivationGuard>
    </DashboardShell>
  )
}
