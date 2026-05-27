'use client'

import type { ComponentType } from 'react'
import { ActivationProgress } from '@/components/activation/ActivationProgress'
import { StepFour_Confirm } from '@/components/activation/StepFour_Confirm'
import { StepOne_Connect } from '@/components/activation/StepOne_Connect'
import { StepThree_Delegate } from '@/components/activation/StepThree_Delegate'
import { StepTwo_SmartAccount } from '@/components/activation/StepTwo_SmartAccount'
import { ActivationProvider, useActivationContext } from '@/providers/ActivationProvider'
import type { ActivationStepId } from '@/types/activation'
import Link from 'next/link'

const STEP_COMPONENTS: Record<
  Exclude<ActivationStepId, 'complete'>,
  ComponentType
> = {
  connect: StepOne_Connect,
  deploy: StepTwo_SmartAccount,
  permissions: StepThree_Delegate,
  fund: StepFour_Confirm,
}

function ActivationWizardInner() {
  const { steps, progressPercent, currentStep, phase, goBack } =
    useActivationContext()

  const canGoBack =
    currentStep !== 'connect' &&
    currentStep !== 'complete' &&
    phase !== 'active' &&
    phase !== 'deploying' &&
    phase !== 'requesting_permissions'

  const ActiveStep =
    currentStep === 'complete'
      ? StepFour_Confirm
      : STEP_COMPONENTS[currentStep]

  return (
    <div className="relative min-h-screen overflow-hidden bg-forge-bg">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(249, 115, 22, 0.15), transparent),
            linear-gradient(rgba(63, 63, 70, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(63, 63, 70, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      <header className="relative z-10 border-b border-forge-border-subtle px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-wide text-forge-orange">
            ForgeOS
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        <div className="mb-10 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-forge-text sm:text-4xl">
            Activate your agent OS
          </h1>
          <p className="mt-2 text-sm text-forge-text-muted">
            Set up in 4 steps. Your agents work for you — safely, within limits you control.
          </p>
        </div>

        <ActivationProgress steps={steps} percent={progressPercent} />

        <div className="mt-8">
          <ActiveStep />
        </div>

        {canGoBack && (
          <div className="mt-4">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm text-forge-text-muted transition-colors hover:text-forge-text"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export function ActivationWizard() {
  return (
    <ActivationProvider>
      <ActivationWizardInner />
    </ActivationProvider>
  )
}
