'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useActivityStore } from '@/stores/activity.store'
import * as Dialog from '@radix-ui/react-dialog'
import { useCommandStore } from '@/stores/command.store'
import { useCommandBar } from '@/hooks/useCommandBar'
import { useAgentExecute } from '@/hooks/useAgentExecute'
import { Button } from '@/components/ui/Button'
import { cn, formatUsdc, explorerTxUrl } from '@/lib/utils'
import { ONESHOT } from '@/lib/constants'
import type { ActionPlan, FlowTiming } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SerialisedPlan extends Omit<ActionPlan, 'estimatedCost' | 'estimatedGas' | 'actions'> {
  estimatedCost: string
  estimatedGas: string
  actions: Array<Omit<ActionPlan['actions'][number], 'value'> & { value: string }>
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function CommandBarModal() {
  useCommandBar() // registers Cmd+K global shortcut
  const { executePlan } = useAgentExecute()

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
  const activityFeed = useActivityStore((s) => s.activityFeed)
  const awaitingTaskId = useRef<string | null>(null)

  // ── Submit query to Venice ─────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    const intent = query.trim()
    if (!intent || command.status === 'reasoning' || command.status === 'planning') return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setCommand({ status: 'reasoning', intent, error: null, errorCode: null })
    setPendingPlan(null)

    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent }),
        signal: abortRef.current.signal,
      })

      const data = (await res.json()) as
        | { success: true; actionPlan: SerialisedPlan; veniceModel: string; cost: string; timing?: FlowTiming }
        | { success: false; error: string; code: string }

      if (data.success) {
        const plan = deserialisePlan(data.actionPlan)
        setCommand({ status: 'planning', actionPlan: plan, timing: data.timing ?? null })
        setPendingPlan(plan)
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7382/ingest/ac790453-c85d-4969-8a8c-a39f7089e0c0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'076bd8'},body:JSON.stringify({sessionId:'076bd8',location:'CommandBarModal.tsx:handleSubmit',message:'command API error',data:{code:data.code,error:(data.error??'').slice(0,300),status:res.status},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setCommand({ status: 'failed', error: data.error, errorCode: data.code })
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setCommand({ status: 'failed', error: 'Could not reach the server. Check your connection and try again.', errorCode: 'NETWORK' })
      }
    }
  }, [query, command.status, setCommand, setPendingPlan])

  // ── Execute approved plan via 1Shot ────────────────────────────────────────

  const handleExecute = useCallback(async (plan: ActionPlan) => {
    setCommand({ status: 'executing' })

    try {
      const { taskId } = await executePlan(plan)
      awaitingTaskId.current = taskId
      setCommand({ status: 'executing', oneShotTaskId: taskId })
    } catch (e) {
      setCommand({ status: 'failed', error: e instanceof Error ? e.message : 'Execute failed' })
    }
  }, [executePlan, setCommand])

  useEffect(() => {
    const taskId = awaitingTaskId.current
    if (!taskId || command.status !== 'executing') return

    const match = activityFeed.find(
      (a) =>
        a.taskId === taskId &&
        (a.status === 'confirmed' || a.status === 'failed'),
    )
    if (!match) return

    awaitingTaskId.current = null
    if (match.status === 'confirmed') {
      setCommand({
        status: 'confirmed',
        oneShotTaskId: taskId,
      })
      setTimeout(() => {
        setOpen(false)
        resetCommand()
        setQuery('')
      }, 2500)
    } else {
      setCommand({
        status: 'failed',
        error: match.description || 'The network rejected this transaction',
      })
    }
  }, [activityFeed, command.status, setCommand, setOpen, resetCommand])

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
              placeholder="Tell your agents what to do… e.g. check my portfolio balance"
              className="flex-1 bg-transparent text-sm text-forge-text placeholder:text-forge-text-subtle focus:outline-none"
            />
            {command.status === 'reasoning' && <Spinner />}
          </div>

          {/* ── Status / plan area ── */}
          <div className="min-h-[80px] p-4">
            {command.status === 'idle' && (
              <p className="text-sm text-forge-text-subtle">
                Describe what you want in plain language, then press Enter. We will show you a plan before anything runs.
              </p>
            )}

            {command.status === 'reasoning' && (
              <p className="text-sm text-forge-text-muted">Understanding your request…</p>
            )}

            {command.status === 'failed' && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-400">Something went wrong</p>
                <p className="text-xs text-red-400/80">
                  {friendlyCommandError(command.error, command.errorCode)}
                </p>
              </div>
            )}

            {(command.status === 'planning' || command.status === 'executing') && pendingPlan && (
              <ActionPlanPreview
                plan={pendingPlan}
                executing={command.status === 'executing'}
                onExecute={() => void handleExecute(pendingPlan)}
              />
            )}

            {command.status === 'executing' && command.oneShotTaskId && (
              <div className="space-y-1">
                <p className="text-sm text-forge-text-muted">Waiting for the network to confirm…</p>
                <p className="font-mono text-xs text-forge-text-subtle">
                  task: {command.oneShotTaskId}
                </p>
              </div>
            )}

            {command.status === 'confirmed' && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-400">Transaction confirmed</p>
                {command.oneShotTaskId && (
                  <p className="font-mono text-xs text-forge-text-muted">
                    Reference: {command.oneShotTaskId}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Footer hint ── */}
          <div className="flex items-center justify-between border-t border-forge-border px-4 py-2">
            <span className="text-xs text-forge-text-subtle">
              AI planning and network fees are handled for you{command.timing && command.timing.steps.venice != null && (<span className="ml-2 opacity-60"> · {command.timing.totalMs}ms total</span>)}
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

      {plan.actions.length === 0 ? (
        <pre className="whitespace-pre-wrap rounded-lg border border-forge-border bg-forge-bg p-3 font-mono text-xs text-forge-text-muted">
          {plan.summary}
        </pre>
      ) : null}

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
          disabled={executing || !plan.withinPolicy || plan.actions.length === 0}
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

// ─── ERROR HELPERS ────────────────────────────────────────────────────────────

function friendlyCommandError(raw: string | null | undefined, code?: string | null): string {
  if (code === 'WALLET_UNCONFIGURED') {
    return raw ?? 'Server agent wallet is not configured. Add AGENT_WALLET_KEY to app/.env.local and restart the dev server.'
  }
  if (code === 'TURNKEY_SIGN_FAILED' || code === 'WALLET_SIGN_FAILED' || code === 'WALLET_NETWORK_ERROR') {
    return raw ?? 'The agent wallet could not sign the Venice request.'
  }
  if (code === 'VENICE_BALANCE_LOW') {
    return raw ?? 'Venice AI prepaid balance is empty. Top up USDC on Base for the server agent wallet (see Venice x402 docs).'
  }
  if (code === 'TREASURY_LOW' || code === 'INSUFFICIENT_TREASURY') {
    return 'Your spending pool is too low for this action. Add funds on the Spending page.'
  }
  if (!raw) return 'Unknown error. Please try again.'
  if (raw.includes('Treasury balance') || raw.includes('INSUFFICIENT_TREASURY')) {
    return 'Your spending pool is too low for this action. Add funds on the Spending page.'
  }
  if (raw.includes('Venice API')) {
    return 'The AI service returned an error. Try again in a moment.'
  }
  return raw
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
