'use client'

import { create } from 'zustand'
import type { ActionPlan, CommandState } from '@/types'

const initialCommand: CommandState = {
  status: 'idle',
  intent: '',
  streamingText: '',
  actionPlan: null,
  runId: null,
  oneShotTaskId: null,
  error: null,
  timing: null,
}

interface CommandStore {
  isOpen: boolean
  command: CommandState
  pendingPlan: ActionPlan | null
  setOpen: (isOpen: boolean) => void
  setCommand: (command: Partial<CommandState>) => void
  setPendingPlan: (plan: ActionPlan | null) => void
  resetCommand: () => void
}

export const useCommandStore = create<CommandStore>((set) => ({
  isOpen: false,
  command: initialCommand,
  pendingPlan: null,
  setOpen: (isOpen) => set({ isOpen }),
  setCommand: (partial) =>
    set((state) => ({ command: { ...state.command, ...partial } })),
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  resetCommand: () => set({ command: initialCommand, pendingPlan: null }),
}))
