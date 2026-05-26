'use client'

import { useRef, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useCommandStore } from '@/stores/command.store'
import { useCommandBar } from '@/hooks/useCommandBar'
import { Button } from '@/components/ui/Button'
import { cn, formatUsdc, explorerTxUrl } from '@/lib/utils'
import { ONESHOT } from '@/lib/constants'
import type { ActionPlan } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SerialisedPlan extends Omit<ActionPlan, 'estimatedCost' | 'estimatedGas' | 'actions'> {
  estimatedCost: string
  estimatedGas: string
  actions: Array<Omit<ActionPlan['actions'][number], 'value'> & { value: string }>
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function CommandBarModal() {
  useCommandBar() // registers Cmd+K global shortcut

  const isOpen = useCommandStore((s) => s.isOpen)
  const setOpen = useCommandStore((s) => s.setOpen)
  const command = useCommandStore((s) => s.command)
  const pendingPlan = useCommandStore((s) => s.pendingPlan)
  const setCommand = useCommandStore((s) => s.setCommand)
  const setPendingPlan = useCommandStore((s) => s.setPendingPlan)
  const resetCommand = useCommandStore((s) => s.resetCommand)

  const [query, setQuery] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Submit query to Venice ─────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const intent = query.trim()
    if (!intent || command.status === 'reasoning' || command.status === 'planning') return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setCommand({ status: 'reasoning', intent, error: null })
    setPendingPlan(null)

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
        signal: abortRef.current.signal,
      })

      const data = (await res.json()) as
        | { success: true; actionPlan: SerialisedPlan; veniceModel: string; cost: string }
        | { success: false; error: string; code: string }

      if (data.success) {
        const plan = deserialisePlan(data.actionPlan)
        setCommand({ status: 'planning', actionPlan: plan })
        setPendingPlan(plan)
      } else {
        setCommand({ status: 'failed', error: data.error })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setCommand({ status: 'failed', error: 'Request failed — check console' })
      }
    }
  }, [query, command.status, setCommand, setPendingPlan])

  // ── Execute approved plan via 1Shot ────────────────────────────────────────

  const handleExecute = useCallback(async (plan: ActionPlan) => {
    setCommand({ status: 'executing' })

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionPlan: serialisePlan(plan) }),
      })

      const data = (await res.json()) as
        | { success: true; taskId: string }
        | { success: false; error: string; code: string }

      if (data.success) {
        setCommand({ status: 'confirmed', oneShotTaskId: data.taskId })
        setTimeout(() => {
          setOpen(false)
          resetCommand()
          setQuery('')
        }, 3000)
      } else {
        setCommand({ status: 'failed', error: data.error })
      }
    } catch {
      setCommand({ status: 'failed', error: 'Execute failed' })
    }
  }, [setCommand, setOpen, resetCommand])

  const handleClose = useCallback(() => {
    abortRef.current?.abort()
    setOpen(false)
    resetCommand()
    setQuery('')
  }, [setOpen, resetCommand])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2 rounded-2xl border border-forge-border bg-forge-surface shadow-2xl focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>

          {/* ── Input row ── */}
          <div className="flex items-center gap-3 border-b border-forge-border px-4 py-3">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit() }}
              placeholder="Ask ForgeOS anything… e.g. rebalance to 60% ETH"
              className="flex-1 bg-transparent text-sm text-forge-text placeholder:text-forge-text-subtle focus:outline-none"
            />
            {command.status === 'reasoning' && <Spinner />}
          </div>

          {/* ── Status / plan area ── */}
          <div className="min-h-[80px] p-4">
            {command.status === 'idle' && (
              <p className="text-sm text-forge-text-subtle">
                Type a command and press Enter. Venice AI will plan the action.
              </p>
            )}

            {command.status === 'reasoning' && (
              <p className="text-sm text-forge-text-muted">Parsing intent with Venice AI…</p>
            )}

            {command.status === 'failed' && (
              <p className="text-sm text-red-400">{command.error}</p>
            )}

            {(command.status === 'planning' || command.status === 'executing') && pendingPlan && (
              <ActionPlanPreview
                plan={pendingPlan}
                executing={command.status === 'executing'}
                onExecute={() => void handleExecute(pendingPlan)}
              />
            )}

            {command.status === 'confirmed' && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-400">Transaction submitted</p>
                {command.oneShotTaskId && (
                  <p className="font-mono text-xs text-forge-text-muted">
                    1Shot task: {command.oneShotTaskId}
                  </p>
                )}
                <p className="text-xs text-forge-text-subtle">
                  Confirmation will appear in activity feed.
                </p>
              </div>
            )}
          </div>

          {/* ── Footer hint ── */}
          <div className="flex items-center justify-between border-t border-forge-border px-4 py-2">
            <span className="text-xs text-forge-text-subtle">
              Powered by Venice AI · Gas sponsored by 1Shot
            </span>
            <kbd className="rounded border border-forge-border bg-forge-bg px-1.5 py-0.5 font-mono text-xs text-forge-text-subtle">
              Esc
            </kbd>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── ACTION PLAN PREVIEW ──────────────────────────────────────────────────────

function ActionPlanPreview({
  plan,
  executing,
  onExecute,
}: {
  plan: ActionPlan
  executing: boolean
  onExecute: () => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{plan.summary}</p>

      <ul className="space-y-1">
        {plan.actions.map((action) => (
          <li key={action.id} className="flex items-start gap-2 text-xs text-forge-text-muted">
            <span className="mt-0.5 shrink-0 text-orange-500">→</span>
            <span>{action.humanDescription}</span>
            {action.estimatedOutput && (
              <span className="ml-auto shrink-0 text-forge-text-subtle">
                {action.estimatedOutput}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between pt-1">
        <div className="space-y-0.5">
          <p className="text-xs text-forge-text-subtle">
            Estimated cost:{' '}
            <span className="text-forge-text">{formatUsdc(plan.estimatedCost)}</span>
          </p>
          {!plan.withinPolicy && (
            <p className="text-xs text-red-400">{plan.policyViolations.join(', ')}</p>
          )}
        </div>
        <Button
          variant="default"
          className={cn('shrink-0', !plan.withinPolicy && 'opacity-50')}
          disabled={executing || !plan.withinPolicy}
          onClick={onExecute}
        >
          {executing ? 'Submitting…' : 'Execute'}
        </Button>
      </div>
    </div>
  )
}

// ─── ICONS ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="shrink-0 text-forge-text-subtle"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-orange-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

// ─── SERIALISATION HELPERS ────────────────────────────────────────────────────

function deserialisePlan(p: SerialisedPlan): ActionPlan {
  return {
    ...p,
    estimatedCost: BigInt(p.estimatedCost),
    estimatedGas: BigInt(p.estimatedGas),
    actions: p.actions.map((a) => ({
      ...a,
      value: BigInt(a.value),
    })),
  }
}

function serialisePlan(plan: ActionPlan): SerialisedPlan {
  return {
    ...plan,
    estimatedCost: plan.estimatedCost.toString(),
    estimatedGas: plan.estimatedGas.toString(),
    actions: plan.actions.map((a) => ({
      ...a,
      value: a.value.toString(),
    })),
  }
}
