'use client'

import { create } from 'zustand'
import type { Delegation, OSKernelConfig, OSStatus, Policy } from '@/types'

interface OSStore {
  osStatus: OSStatus
  osKernel: OSKernelConfig | null
  rootDelegation: Delegation | null
  policy: Policy | null
  activationStep: number
  setOsStatus: (status: OSStatus) => void
  setKernel: (kernel: OSKernelConfig | null) => void
  setRootDelegation: (delegation: Delegation | null) => void
  setPolicy: (policy: Policy | null) => void
  setActivationStep: (step: number) => void
}

export const useOsStore = create<OSStore>((set) => ({
  osStatus: 'inactive',
  osKernel: null,
  rootDelegation: null,
  policy: null,
  activationStep: 0,
  setOsStatus: (osStatus) => set({ osStatus }),
  setKernel: (osKernel) => set({ osKernel }),
  setRootDelegation: (rootDelegation) => set({ rootDelegation }),
  setPolicy: (policy) => set({ policy }),
  setActivationStep: (activationStep) => set({ activationStep }),
}))
