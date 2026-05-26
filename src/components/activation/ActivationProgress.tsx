'use client'

import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ActivationStepState } from '@/types/activation'
import { Check, Loader2 } from 'lucide-react'

export function ActivationProgress({
  steps,
  percent,
}: {
  steps: ActivationStepState[]
  percent: number
}) {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-forge-text-muted">
          <span>Activation progress</span>
          <span className="font-mono text-forge-orange">{percent}%</span>
        </div>
        <Progress value={percent} className="gap-0">
          <ProgressTrack className="h-2 bg-forge-elevated">
            <ProgressIndicator className="bg-forge-orange" />
          </ProgressTrack>
        </Progress>
      </div>
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
              step.status === 'current' &&
                'border-forge-orange/50 bg-forge-orange/5',
              step.status === 'complete' &&
                'border-forge-success/30 bg-forge-success/5',
              step.status === 'pending' &&
                'border-forge-border-subtle bg-forge-surface/50',
              step.status === 'error' && 'border-forge-danger/50 bg-forge-danger/10',
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                step.status === 'complete' && 'bg-forge-success text-forge-text-inverse',
                step.status === 'current' && 'bg-forge-orange text-forge-text-inverse',
                step.status === 'pending' && 'bg-forge-elevated text-forge-text-muted',
                step.status === 'error' && 'bg-forge-danger text-white',
              )}
            >
              {step.status === 'complete' ? (
                <Check className="size-3" />
              ) : step.status === 'current' ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                i + 1
              )}
            </span>
            <span>
              <span className="block font-medium text-forge-text">{step.title}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
