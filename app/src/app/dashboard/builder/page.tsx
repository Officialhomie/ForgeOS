'use client'

import { useAgentBuilder } from '@/hooks/useAgentBuilder'
import { AGENT_TEMPLATES } from '@/lib/agents/templates'
import { TemplateCard } from '@/components/builder/TemplateCard'
import { AgentConfigForm } from '@/components/builder/AgentConfigForm'
import { CaveatPreview } from '@/components/builder/CaveatPreview'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { AgentId } from '@/types'

// ─── STEP INDICATOR ────────────────────────────────────────────────────────────

function StepIndicator({
  step,
}: {
  step: 'idle' | 'configuring' | 'testing' | 'approving' | 'publishing' | 'deployed'
}) {
  const steps = [
    { key: 'idle', label: 'Pick a type' },
    { key: 'configuring', label: 'Set up' },
    { key: 'testing', label: 'Try it' },
    { key: 'approving', label: 'Approve' },
    { key: 'publishing', label: 'Launch' },
    { key: 'deployed', label: 'Done' },
  ]

  const order = ['idle', 'configuring', 'testing', 'approving', 'publishing', 'deployed']
  const currentIndex = Math.max(0, order.indexOf(step))

  return (
    <nav className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              i < currentIndex
                ? 'bg-orange-500 text-white'
                : i === currentIndex
                ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40'
                : 'bg-forge-border text-forge-text-subtle'
            }`}
          >
            {i < currentIndex ? (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              i <= currentIndex ? 'text-forge-text' : 'text-forge-text-subtle'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < currentIndex ? 'bg-orange-500' : 'bg-forge-border'}`} />
          )}
        </div>
      ))}
    </nav>
  )
}

// ─── SUCCESS SCREEN ───────────────────────────────────────────────────────────

function LaunchedView({
  agentId,
  taskId,
  ipfsUri,
  onReset,
}: {
  agentId: string
  taskId: string | null
  ipfsUri: string | null
  onReset: () => void
}) {
  return (
    <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
      <div className="flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
          <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-forge-text">Your agent is up and running!</h2>
        <p className="mt-1 text-sm text-forge-text-muted">
          It is working in the background now. Sit back and relax.
        </p>
      </div>

      <div className="rounded-xl border border-forge-border bg-forge-surface p-4 text-left space-y-3">
        <div>
          <p className="text-xs text-forge-text-subtle">Agent ID</p>
          <p className="mt-0.5 font-mono text-sm text-forge-text">{agentId}</p>
        </div>
        {taskId && (
          <div>
            <p className="text-xs text-forge-text-subtle">Confirmation ID</p>
            <p className="mt-0.5 font-mono text-sm text-forge-text">{taskId}</p>
          </div>
        )}
        {ipfsUri && (
          <div>
            <p className="text-xs text-forge-text-subtle">Public profile link</p>
            <p className="mt-0.5 break-all font-mono text-xs text-forge-text">{ipfsUri}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onReset}>
          Start fresh
        </Button>
        <Button variant="default" className="flex-1" onClick={() => { window.location.href = '/marketplace' }}>
          Browse marketplace
        </Button>
      </div>
    </div>
  )
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const {
    step,
    selectedTemplate,
    configValues,
    prompt,
    spendCap,
    intervalHours,
    deployedAgent,
    error,
    selectTemplate,
    setConfigValues,
    setPrompt,
    setSpendCap,
    setIntervalHours,
    saveDraft,
    loadDraft,
    testAgent,
    approveAgent,
    testResult,
    deployAgent,
    reset,
  } = useAgentBuilder()

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forge-text">Create an agent</h1>
          <p className="mt-1 text-sm text-forge-text-muted">
            Choose what you want your agent to do, set how much it can spend, and let it run hands-free.
          </p>
        </div>
        {step !== 'idle' && step !== 'deployed' && (
          <Button variant="ghost" onClick={reset}>
            Start over
          </Button>
        )}
      </div>

      {/* Step indicator */}
      {step !== 'idle' && (
        <StepIndicator step={step} />
      )}

      {/* Step 1 — Pick a type */}
      {step === 'idle' && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-forge-text">What do you want your agent to do?</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_TEMPLATES.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => selectTemplate(template.id as AgentId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Customise */}
      {step === 'configuring' && selectedTemplate && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: form */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-forge-text">Make it yours</h2>
              <p className="mt-0.5 text-sm text-forge-text-muted">
                Tell the agent how to behave and how much it is allowed to spend.
              </p>
            </div>
            <AgentConfigForm
              template={selectedTemplate}
              values={configValues}
              prompt={prompt}
              spendCap={spendCap}
              intervalHours={intervalHours}
              onValuesChange={setConfigValues}
              onPromptChange={setPrompt}
              onSpendCapChange={setSpendCap}
              onIntervalChange={setIntervalHours}
            />
          </div>

          {/* Right: limits preview + launch */}
          <div className="space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-base font-semibold text-forge-text">
              What this agent can and cannot do
              <Tooltip
                content="These are the hard limits for this agent. It cannot spend more, run more often, or do more than what you see here."
                side="top"
              />
            </span>
              <p className="mt-0.5 text-sm text-forge-text-muted">
                These are hard limits. The agent can never do more than what you see here, no matter what.
              </p>
            </div>
            <CaveatPreview
              caveats={selectedTemplate.defaultCaveats}
              spendCap={spendCap}
              intervalSeconds={intervalHours * 3600}
            />

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {testResult && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300">
            Looking good: {testResult}
            </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={saveDraft}>
                Save for later
              </Button>
              <Button variant="secondary" onClick={() => void testAgent()}>
                Try it out
              </Button>
              <Button variant="secondary" onClick={() => void approveAgent()}>
                Grant access
              </Button>
            </div>

            <div className="space-y-1">
              <Button variant="default" className="w-full" onClick={deployAgent}>
                Launch agent
              </Button>
              <p className="flex items-center justify-center gap-1 text-xs text-forge-text-subtle">
                You will tap Approve in your wallet — just once
                <Tooltip
                  content="Publishing saves your agent so others can find it. After you approve in your wallet, the agent can run on the schedule you set."
                  side="top"
                />
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Launching */}
      {(step === 'testing' || step === 'approving' || step === 'publishing') && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-forge-text-muted">
            {step === 'testing' && 'Checking everything looks right…'}
            {step === 'approving' && 'Waiting for your OK in MetaMask…'}
            {step === 'publishing' && 'Launching your agent…'}
          </p>
        </div>
      )}

      {/* Step 4 — Live */}
      {step === 'deployed' && deployedAgent && (
        <LaunchedView
          agentId={deployedAgent.agentId}
          taskId={deployedAgent.taskId}
          ipfsUri={deployedAgent.ipfsUri}
          onReset={reset}
        />
      )}
    </div>
  )
}
