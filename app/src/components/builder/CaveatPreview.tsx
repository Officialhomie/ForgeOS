'use client'

import type { CaveatTemplate } from '@/lib/agents/templates'
import { Tooltip } from '@/components/ui/Tooltip'

export function CaveatPreview({
  caveats,
  spendCap,
  intervalSeconds,
}: {
  caveats: CaveatTemplate[]
  spendCap?: number
  intervalSeconds?: number
}) {
  type RuleLine = { text: string; tip: string }
  const summaryLines: RuleLine[] = []

  if (spendCap) {
    summaryLines.push({
      text: `Spends at most $${spendCap} USDC per action`,
      tip: 'The agent will never spend more than this amount in a single action, no matter what it is told to do.',
    })
  }

  caveats.forEach((c) => {
    if (c.enforcerName === 'AllowedMethodsEnforcer') {
      summaryLines.push({
        text: 'Can only call pre-approved actions',
        tip: 'The agent is locked to a specific list of operations. It cannot call any function outside that list.',
      })
    } else if (c.enforcerName === 'AllowedTargetsEnforcer') {
      summaryLines.push({
        text: 'Can only interact with pre-approved destinations',
        tip: 'The agent can only send funds or interact with specific approved addresses — not arbitrary wallets or contracts.',
      })
    } else if (c.enforcerName === 'LimitedCallsEnforcer') {
      const limit = (c.defaultTerms.limit as number) ?? 1
      summaryLines.push({
        text: `Limited to ${limit} action${limit !== 1 ? 's' : ''} per run`,
        tip: `The agent can take at most ${limit} action${limit !== 1 ? 's' : ''} each time it wakes up. This prevents runaway behaviour.`,
      })
    }
  })

  if (intervalSeconds) {
    const hours = intervalSeconds / 3600
    summaryLines.push({
      text: `Runs automatically every ${hours < 1 ? `${intervalSeconds / 60} minutes` : `${hours} hour${hours !== 1 ? 's' : ''}`}`,
      tip: 'This is how often the agent wakes up in the background and acts on your behalf. You can change this at any time.',
    })
  }

  return (
    <div className="rounded-lg border border-forge-border bg-forge-bg p-4">
      <p className="mb-2 text-xs font-medium text-forge-text-muted">Automatic protections</p>

      {summaryLines.length > 0 && (
        <ul className="mb-3 space-y-1">
          {summaryLines.map(({ text, tip }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-forge-text">
              <span className="mt-0.5 text-forge-success">✓</span>
              <span className="flex items-center gap-1.5">
                {text}
                <Tooltip content={tip} side="right" />
              </span>
            </li>
          ))}
        </ul>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs text-forge-text-subtle hover:text-forge-text">
          Show developer details
        </summary>
        <pre className="mt-2 overflow-x-auto rounded border border-forge-border-subtle bg-forge-surface p-2 font-mono text-xs text-forge-mono">
          {JSON.stringify(
            caveats.map((c) => ({
              enforcer: c.enforcer,
              name: c.enforcerName,
              terms: c.defaultTerms,
            })),
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  )
}
