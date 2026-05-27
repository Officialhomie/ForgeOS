'use client'

import { Button } from '@/components/ui/Button'
import type { AgentTemplate } from '@/lib/agents/templates'
import { Tooltip } from '@/components/ui/Tooltip'

const CATEGORY_COLORS = {
  defi: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  payments: 'text-green-400 bg-green-400/10 border-green-400/20',
  nfts: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  social: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  data: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
} as const

const CATEGORY_LABELS = {
  defi: 'DeFi',
  payments: 'Payments',
  nfts: 'NFT',
  social: 'Social',
  data: 'Data',
} as const

export function TemplateCard({
  template,
  onSelect,
}: {
  template: AgentTemplate
  onSelect: () => void
}) {
  const colorClass = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS.data
  const label = CATEGORY_LABELS[template.category] ?? template.category

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-forge-border bg-forge-surface p-5 transition-colors hover:border-orange-500/40">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-forge-text">{template.name}</h3>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
        >
          {label}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-forge-text-muted">{template.description}</p>

      <div className="mt-auto space-y-1 text-xs text-forge-text-subtle">
        <p>
          Runs every{' '}
          <span className="text-forge-text">
            {template.defaultIntervalSeconds < 3600
              ? `${template.defaultIntervalSeconds / 60} min`
              : `${template.defaultIntervalSeconds / 3600}h`}
          </span>
        </p>
        <span className="flex items-center gap-1">
          {template.defaultCaveats.length} built-in safety rule{template.defaultCaveats.length !== 1 ? 's' : ''}
          <Tooltip
            content="Automatic guardrails applied to every action this agent takes. These cannot be overridden or bypassed — they are enforced at the smart contract level."
            side="bottom"
          />
        </span>
      </div>

      <Button variant="default" className="w-full" onClick={onSelect}>
        Use this
      </Button>
    </div>
  )
}
