import { DashboardShell } from '@/components/layout/DashboardShell'

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardShell>{children}</DashboardShell>
}
