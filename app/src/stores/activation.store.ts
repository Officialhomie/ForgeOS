'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ActivationPhase, ActivationStepId } from '@/types/activation'
import type { Address, Hash } from '@/types'

interface ActivationState {
  phase: ActivationPhase
  completedSteps: ActivationStepId[]
  smartAccountAddress: Address | null
  delegationHash: Hash | null
  deployTxHash: Hash | null
  fundTxHash: Hash | null
  oneShotTaskId: string | null
}

interface ActivationStore extends ActivationState {
  setPhase: (phase: ActivationPhase) => void
  setCompletedSteps: (steps: ActivationStepId[]) => void
  addCompletedStep: (step: ActivationStepId) => void
  setSmartAccountAddress: (addr: Address | null) => void
  setDelegationHash: (hash: Hash | null) => void
  setDeployTxHash: (hash: Hash | null) => void
  setFundTxHash: (hash: Hash | null) => void
  setOneShotTaskId: (id: string | null) => void
  reset: () => void
}

const INITIAL: ActivationState = {
  phase: 'idle',
  completedSteps: [],
  smartAccountAddress: null,
  delegationHash: null,
  deployTxHash: null,
  fundTxHash: null,
  oneShotTaskId: null,
}

export const useActivationStore = create<ActivationStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setPhase: (phase) => set({ phase }),
      setCompletedSteps: (completedSteps) => set({ completedSteps }),
      addCompletedStep: (step) => {
        const { completedSteps } = get()
        if (!completedSteps.includes(step)) {
          set({ completedSteps: [...completedSteps, step] })
        }
      },
      setSmartAccountAddress: (smartAccountAddress) => set({ smartAccountAddress }),
      setDelegationHash: (delegationHash) => set({ delegationHash }),
      setDeployTxHash: (deployTxHash) => set({ deployTxHash }),
      setFundTxHash: (fundTxHash) => set({ fundTxHash }),
      setOneShotTaskId: (oneShotTaskId) => set({ oneShotTaskId }),
      reset: () => set(INITIAL),
    }),
    {
      name: 'forgeos-activation',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
