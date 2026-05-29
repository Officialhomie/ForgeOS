'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMarketplace } from '@/hooks/useMarketplace'
import { recoverPendingFromIpfsUri } from '@/lib/registry/pending-storage'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

// ─── CATEGORY FILTER ──────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'defi', 'payments', 'nfts', 'social', 'data', 'custom'] as const
type Category = (typeof CATEGORIES)[number]

const CATEGORY_COLORS: Record<string, string> = {
  defi: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  payments: 'text-green-400 bg-green-400/10 border-green-400/20',
  nfts: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  social: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  data: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  custom: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20',
}

const CATEGORY_LABELS: Record<string, string> = {
  defi: 'DeFi',
  payments: 'Payments',
  nfts: 'NFT',
  social: 'Social',
  data: 'Data',
  custom: 'Custom',
}

function CategoryBadge({ category }: { category: string }) {
  const colorClass = CATEGORY_COLORS[category.toLowerCase()] ?? CATEGORY_COLORS.custom
  const label = CATEGORY_LABELS[category.toLowerCase()] ?? category
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

// ─── AGENT CARD ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
}: {
  agent: ReturnType<typeof useMarketplace>['agents'][number]
}) {
  const category = (agent.metadata?.category ?? 'custom').toLowerCase()
  const description = agent.metadata?.description ?? 'No description available.'

  return (
    <Link href={`/marketplace/${agent.agentId}`} className="block">
      <div className="flex flex-col gap-3 rounded-xl border border-forge-border bg-forge-surface p-5 transition-colors hover:border-orange-500/40 h-full">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-forge-text leading-tight">{agent.name}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {agent.pending && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                Confirming on-chain
              </span>
            )}
            <CategoryBadge category={category} />
          </div>
        </div>

        <p className="text-sm leading-relaxed text-forge-text-muted line-clamp-3">{description}</p>

        <div className="mt-auto space-y-1 text-xs text-forge-text-subtle">
          <p>
            Made by{' '}
            <span className="font-mono text-forge-text">
              {agent.creator.slice(0, 6)}...{agent.creator.slice(-4)}
            </span>
          </p>
          {agent.metadata?.version && (
            <p>Version {agent.metadata.version}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { agents, loading, error, refetch } = useMarketplace()
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const recover = params.get('recoverIpfs')
    if (!recover) return
    const recoverAgentId = params.get('recoverAgentId') as `0x${string}` | null
    void recoverPendingFromIpfsUri(recover, {
      agentId: recoverAgentId ?? undefined,
    }).then(() => {
      void refetch()
      params.delete('recoverIpfs')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    })
  }, [refetch])

  const filtered = activeCategory === 'all'
    ? agents
    : agents.filter(
        (a) => (a.metadata?.category ?? 'custom').toLowerCase() === activeCategory,
      )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forge-text">Agent Marketplace</h1>
          <p className="mt-1 text-sm text-forge-text-muted">
            Browse ready-made AI agents, pick one, and put it to work — no coding required.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Link href="/dashboard/builder">
            <Button variant="default">Build your own</Button>
          </Link>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                : 'border-forge-border bg-forge-surface text-forge-text-muted hover:border-orange-500/20 hover:text-forge-text'
            }`}
          >
            {cat === 'all' ? 'All' : (CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1))}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={activeCategory === 'all' ? 'No agents published yet' : `No ${CATEGORY_LABELS[activeCategory] ?? activeCategory} agents yet`}
          description={
            activeCategory === 'all'
              ? 'Nobody has published an agent yet. Be the first.'
              : 'Try a different category or build your own agent.'
          }
          action={
            <Link href="/dashboard/builder">
              <Button variant="default">Build an agent</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </div>
      )}

      {/* Stats */}
      {!loading && !error && agents.length > 0 && (
        <p className="text-xs text-forge-text-subtle">
          {agents.length} agent{agents.length !== 1 ? 's' : ''} available
          {activeCategory !== 'all' && ` · ${filtered.length} matching`}
        </p>
      )}
    </div>
  )
}
