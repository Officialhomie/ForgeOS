import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ForgeMark } from '@/components/ui/ForgeMark'

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-forge-bg px-6 text-center overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Radial center glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 600,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(249,115,22,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Large mark */}
        <div className="mb-8">
          <ForgeMark size={80} />
        </div>

        {/* Wordmark */}
        <h1 className="text-5xl font-bold tracking-tight text-forge-text sm:text-6xl">
          Forge<span className="text-forge-orange">OS</span>
        </h1>

        {/* Tagline */}
        <p className="mt-5 max-w-md text-lg text-forge-text-muted leading-relaxed">
          Run AI agents that work for you — with spending limits you set,
          permissions you control, and a wallet you always own.
        </p>

        {/* Tech stack badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            'Smart Accounts (ERC-4337)',
            'Venice AI',
            'x402 Payments',
            'A2A Delegation',
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-forge-border bg-forge-surface px-2.5 py-1 font-mono text-xs text-forge-text-subtle"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-10 flex gap-3">
          <Link href="/dashboard">
            <Button>Open Dashboard</Button>
          </Link>
          <Link href="/activate">
            <Button variant="ghost">Activate Wallet</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
