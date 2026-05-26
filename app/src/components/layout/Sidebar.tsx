'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bot,
  GitBranch,
  LayoutDashboard,
  Repeat,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/constants'
import { useOsStore } from '@/stores/os.store'

const ICONS = {
  LayoutDashboard,
  Bot,
  GitBranch,
  Wallet,
  Repeat,
} as const

export function Sidebar() {
  const pathname = usePathname()
  const osStatus = useOsStore((s) => s.osStatus)

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-forge-border bg-forge-surface px-3 py-4">
      <div className="mb-6 px-3">
        <span className="text-lg font-bold text-forge-orange">ForgeOS</span>
        <p className="text-xs text-forge-text-subtle">Agent kernel</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS]
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-forge-elevated text-forge-text'
                  : 'text-forge-text-muted hover:bg-forge-elevated hover:text-forge-text',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto rounded-lg border border-forge-border-subtle bg-forge-bg px-3 py-3">
        <p className="text-xs text-forge-text-subtle">OS Status</p>
        <p className="mt-1 text-sm font-medium capitalize text-forge-success">
          {osStatus}
        </p>
      </div>
    </aside>
  )
}
