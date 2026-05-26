'use client'

import { cn, truncateAddress } from '@/lib/utils'
import type { RunStatus, Hash } from '@/types'

// ─── STEPS ────────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Venice Parse', description: 'Intent parsed by AI' },
  { label: 'Delegation Check', description: 'Caveats validated' },
  { label: '1Shot Relay', description: 'UserOp submitted' },
  { label: 'Confirmed', description: 'On-chain finalized' },
] as const

type StepState = 'done' | 'active' | 'pending' | 'failed'

function getStepStates(status: RunStatus): [StepState, StepState, StepState, StepState] {
  switch (status) {
    case 'pending':
    case 'reasoning':
      return ['active', 'pending', 'pending', 'pending']
    case 'planning':
      return ['done', 'active', 'pending', 'pending']
    case 'executing':
      return ['done', 'done', 'active', 'pending']
    case 'confirmed':
      return ['done', 'done', 'done', 'done']
    case 'failed':
      return ['done', 'done', 'failed', 'pending']
    case 'reverted':
      return ['done', 'done', 'done', 'failed']
    default:
      return ['pending', 'pending', 'pending', 'pending']
  }
}

// ─── STEP DOT ─────────────────────────────────────────────────────────────────

function StepDot({ state }: { state: StepState }) {
  return (
    <div
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
        state === 'done' && 'border-forge-success bg-forge-success/20',
        state === 'active' && 'animate-pulse border-forge-orange bg-forge-orange/20',
        state === 'pending' && 'border-forge-border bg-forge-elevated',
        state === 'failed' && 'border-forge-danger bg-forge-danger/20',
      )}
    >
      {state === 'done' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6l3 3 5-5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-forge-success"
          />
        </svg>
      )}
      {state === 'active' && <div className="h-2 w-2 rounded-full bg-forge-orange" />}
      {state === 'failed' && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-forge-danger"
          />
        </svg>
      )}
    </div>
  )
}

// ─── CONNECTOR LINE ───────────────────────────────────────────────────────────

function Connector({ filled }: { filled: boolean }) {
  return (
    <div
      className={cn(
        'h-0.5 flex-1 transition-colors',
        filled ? 'bg-forge-success' : 'bg-forge-border',
      )}
    />
  )
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export function ActionPlanVisualizer({ status }: { status: RunStatus }) {
  const states = getStepStates(status)

  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-4">
      <div className="flex items-start">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && <Connector filled={states[i - 1] === 'done'} />}
              <StepDot state={states[i]} />
              {i < STEPS.length - 1 && <Connector filled={states[i] === 'done'} />}
            </div>
            <div className="mt-2 px-1 text-center">
              <p
                className={cn(
                  'text-xs font-medium',
                  states[i] === 'done' && 'text-forge-success',
                  states[i] === 'active' && 'text-forge-orange',
                  states[i] === 'failed' && 'text-forge-danger',
                  states[i] === 'pending' && 'text-forge-text-subtle',
                )}
              >
                {step.label}
              </p>
              <p className="text-[10px] text-forge-text-subtle">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── A2A CHAIN VISUALIZER ─────────────────────────────────────────────────────
//
// P8.6 — Shows the 2-hop delegation chain during A2A execution.
// Each node lights up green when confirmed. Delegation hashes shown between hops.

export type A2AHopStatus = 'pending' | 'active' | 'done' | 'failed'

export interface A2AChainState {
  hop0: A2AHopStatus   // OSKernel (root)
  hop1: A2AHopStatus   // DeFiAgent (sub-delegation)
  hop2: A2AHopStatus   // PaymentAgent (re-delegation)
}

/** Derive A2AChainState from a RunStatus */
export function runStatusToA2AState(status: RunStatus): A2AChainState {
  switch (status) {
    case 'pending':
    case 'reasoning':
      return { hop0: 'active', hop1: 'pending', hop2: 'pending' }
    case 'planning':
      return { hop0: 'done', hop1: 'active', hop2: 'pending' }
    case 'executing':
      return { hop0: 'done', hop1: 'done', hop2: 'active' }
    case 'confirmed':
      return { hop0: 'done', hop1: 'done', hop2: 'done' }
    case 'failed':
    case 'reverted':
      return { hop0: 'done', hop1: 'done', hop2: 'failed' }
    default:
      return { hop0: 'pending', hop1: 'pending', hop2: 'pending' }
  }
}

interface A2ANode {
  label: string
  sublabel: string
  hash?: Hash
}

function A2ANodeDot({ status, label, sublabel, hash }: A2ANode & { status: A2AHopStatus }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          status === 'done' && 'border-forge-success bg-forge-success/15',
          status === 'active' && 'animate-pulse border-forge-orange bg-forge-orange/15',
          status === 'pending' && 'border-forge-border bg-forge-elevated',
          status === 'failed' && 'border-forge-danger bg-forge-danger/15',
        )}
      >
        {status === 'done' && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7l3 3 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-forge-success"
            />
          </svg>
        )}
        {status === 'active' && <div className="h-2.5 w-2.5 rounded-full bg-forge-orange" />}
        {status === 'failed' && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3.5 3.5l7 7M10.5 3.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="text-forge-danger"
            />
          </svg>
        )}
        {status === 'pending' && (
          <div className="h-2 w-2 rounded-full bg-forge-border" />
        )}
      </div>
      <p
        className={cn(
          'text-center text-[11px] font-semibold',
          status === 'done' && 'text-forge-success',
          status === 'active' && 'text-forge-orange',
          status === 'failed' && 'text-forge-danger',
          status === 'pending' && 'text-forge-text-subtle',
        )}
      >
        {label}
      </p>
      <p className="text-center text-[10px] text-forge-text-subtle">{sublabel}</p>
      {hash && (
        <p className="font-mono text-[9px] text-forge-text-subtle">
          {truncateAddress(hash, 3)}
        </p>
      )}
    </div>
  )
}

function A2AConnector({
  filled,
  label,
}: {
  filled: boolean
  label: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-1">
      <div
        className={cn(
          'h-0.5 w-full transition-colors',
          filled ? 'bg-forge-success' : 'bg-forge-border',
        )}
      />
      <p className="text-[9px] text-forge-text-subtle">{label}</p>
    </div>
  )
}

/**
 * A2AChainVisualizer — renders the 3-node delegation chain for the A2A demo.
 *
 * OSKernel (root) ──── DeFiAgent (hop 1) ──── PaymentAgent (hop 2)
 *
 * @param state     Live status of each hop (use runStatusToA2AState() to derive)
 * @param defiHash  Hash of the OSKernel → DeFiAgent sub-delegation
 * @param redelHash Hash of the DeFiAgent → PaymentAgent re-delegation
 */
export function A2AChainVisualizer({
  state,
  defiHash,
  redelHash,
}: {
  state: A2AChainState
  defiHash?: Hash
  redelHash?: Hash
}) {
  return (
    <div className="rounded-xl border border-forge-border bg-forge-surface p-5">
      <p className="mb-4 text-xs font-medium text-forge-text-muted">
        A2A delegation chain · 2 hops
      </p>
      <div className="flex items-start">
        <A2ANodeDot
          status={state.hop0}
          label="OSKernel"
          sublabel="Root delegation"
        />
        <A2AConnector
          filled={state.hop1 === 'done' || state.hop1 === 'active'}
          label={defiHash ? `sub-del ${truncateAddress(defiHash, 3)}` : 'sub-delegation'}
        />
        <A2ANodeDot
          status={state.hop1}
          label="DeFiAgent"
          sublabel="Hop 1"
          hash={defiHash}
        />
        <A2AConnector
          filled={state.hop2 === 'done' || state.hop2 === 'active'}
          label={redelHash ? `re-del ${truncateAddress(redelHash, 3)}` : 're-delegation'}
        />
        <A2ANodeDot
          status={state.hop2}
          label="PaymentAgent"
          sublabel="Hop 2"
          hash={redelHash}
        />
      </div>
    </div>
  )
}
