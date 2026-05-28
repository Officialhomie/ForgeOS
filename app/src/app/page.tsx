import Link from 'next/link'
import { Button } from '@/components/ui/Button'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-forge-bg px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-forge-text">
        Forge<span className="text-forge-orange">OS</span>
      </h1>
      <p className="mt-4 max-w-md text-forge-text-muted">
        Run AI agents that work for you — with spending limits you set, permissions you
        control, and a wallet you always own.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/dashboard">
          <Button>Open Dashboard</Button>
        </Link>
        <Link href="/activate">
          <Button variant="ghost">Activate</Button>
        </Link>
      </div>
    </div>
  )
}
