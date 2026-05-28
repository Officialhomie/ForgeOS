'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useMarketplace } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { Tooltip } from '@/components/ui/Tooltip'
import type { MarketplaceAgent } from '@/hooks/useMarketplace'

// ─── RULE ROW ─────────────────────────────────────────────────────────────────

function RuleRow({ enforcer, terms }: { enforcer: string; terms: unknown }) {
  // Map enforcer contract addresses to human-readable rule names
  const ruleLabel = enforcer.includes('ERC20TransferAmount')
    ? 'Spending limit'
    : enforcer.includes('AllowedMethods')
    ? 'Allowed actions'
    : enforcer.includes('AllowedTargets')
    ? 'Allowed destinations'
    : enforcer.includes('LimitedCalls')
    ? 'Usage limit'
    : enforcer.includes('Timestamp')
    ? 'Time restriction'
    : 'Safety rule'

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-forge-border bg-forge-bg/50 px-3 py-2">
      <span className="text-sm font-medium text-forge-text">{ruleLabel}</span>
      <span className="text-xs text-forge-text-muted font-mono">{JSON.stringify(terms)}</span>
    </div>
  )
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = use(params)
  const { agents, loading, installAgent } = useMarketplace()
  const [agent, setAgent] = useState<MarketplaceAgent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installResult, setInstallResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (!loading && agents.length > 0) {
      const found = agents.find((a) => a.agentId === agentId)
      setAgent(found ?? null)
    }
  }, [agents, loading, agentId])

  const handleInstall = async () => {
    if (!agent) return
    setInstalling(true)
    setInstallResult(null)
    const result = await installAgent(agent.agentId)
    setInstallResult(result)
    setInstalling(false)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <LoadingSkeleton className="h-10 w-64 rounded-lg" />
        <LoadingSkeleton className="h-48 rounded-xl" />
        <LoadingSkeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-forge-text-muted text-sm">Agent not found.</p>
        <Link href="/marketplace">
          <Button variant="secondary">Back to marketplace</Button>
        </Link>
      </div>
    )
  }

  const category = (agent.metadata?.category ?? 'custom').toLowerCase()
  const description = agent.metadata?.description ?? 'No description available.'
  const caveatTemplate = agent.metadata?.caveatTemplate
  const rules = Array.isArray(caveatTemplate)
    ? (caveatTemplate as Array<{ enforcer: string; terms: unknown }>)
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm text-forge-text-muted hover:text-forge-text">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Marketplace
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-forge-border bg-forge-surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-forge-text">{agent.name}</h1>
              <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-400">
                {category}
              </span>
            </div>
            <p className="text-sm text-forge-text-muted">{description}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="inline-flex items-center gap-1 text-forge-text-subtle">
              Made by
              <Tooltip content="The wallet address of the person who created and published this agent to the marketplace." side="right" />
            </span>
            <p className="mt-0.5 font-mono text-forge-text">
              {agent.creator.slice(0, 8)}...{agent.creator.slice(-6)}
            </p>
          </div>
          <div>
            <p className="text-forge-text-subtle">Version</p>
            <p className="mt-0.5 text-forge-text">{agent.metadata?.version ?? '1.0.0'}</p>
          </div>
          {agent.txHash && (
            <div>
              <p className="text-forge-text-subtle">Published</p>
              <p className="mt-0.5 font-mono text-forge-text">
                {agent.txHash.slice(0, 8)}...{agent.txHash.slice(-6)}
              </p>
            </div>
          )}
          {agent.blockNumber && (
            <div>
              <p className="text-forge-text-subtle">Network record</p>
              <p className="mt-0.5 text-forge-text">#{agent.blockNumber}</p>
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      {rules.length > 0 && (
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-forge-text">
            What this agent can do
            <Tooltip
              content="These are permanent guardrails built into this agent. Every rule here is enforced automatically — no one can override them, not even the agent's creator."
              side="right"
            />
          </span>
          <p className="text-sm text-forge-text-muted">
            These rules are automatically enforced — the agent can never go beyond them, no matter what.
          </p>
          <div className="space-y-2">
            {rules.map((r, i) => (
              <RuleRow key={i} enforcer={r.enforcer} terms={r.terms} />
            ))}
          </div>
        </div>
      )}

      {/* Prompt preview */}
      {agent.metadata?.promptTemplate && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-forge-text">Agent instructions</h2>
          <p className="text-sm text-forge-text-muted">
            This is what the agent is told to do every time it runs.
          </p>
          <pre className="overflow-auto rounded-xl border border-forge-border bg-forge-bg p-4 text-xs text-forge-text-muted whitespace-pre-wrap">
            {String(agent.metadata.promptTemplate)}
          </pre>
        </div>
      )}

      {/* Install */}
      <div className="rounded-xl border border-forge-border bg-forge-surface p-6 space-y-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-forge-text">
            Add to your account
            <Tooltip
              content="When you tap the button below, your wallet will open and ask you to approve this agent. You are not sending money — you are granting a permission. You can remove it anytime from your dashboard."
              side="top"
            />
          </span>
          <p className="mt-1 text-sm text-forge-text-muted">
            Your wallet will ask you to approve this agent. Once approved, it can only do exactly
            what is listed in the rules above — nothing more, nothing less.
          </p>
        </div>

        {installResult && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              installResult.success
                ? 'border-green-500/20 bg-green-500/10 text-green-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            {installResult.success ? 'Agent added to your account.' : installResult.error}
          </div>
        )}

        {!installResult?.success && (
          <Button
            variant="default"
            className="w-full"
            onClick={() => void handleInstall()}
            disabled={installing}
          >
            {installing ? 'Waiting for your approval...' : 'Add to my account'}
          </Button>
        )}
      </div>
    </div>
  )
}
