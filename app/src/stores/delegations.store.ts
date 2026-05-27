'use client'

import { create } from 'zustand'
import type { Delegation } from '@/types'

interface DelegationsStore {
  delegations: Delegation[]
  /** OSKernel → DeFiAgent sub-delegation (hop 1, auto-created on dashboard load) */
  subDelegation: Delegation | null
  /** DeFiAgent → PaymentAgent re-delegation (hop 2, auto-created on dashboard load) */
  reDelegation: Delegation | null
  loading: boolean
  setDelegations: (delegations: Delegation[]) => void
  setSubDelegation: (d: Delegation | null) => void
  setReDelegation: (d: Delegation | null) => void
  setLoading: (loading: boolean) => void
}

export const useDelegationsStore = create<DelegationsStore>((set) => ({
  delegations: [],
  subDelegation: null,
  reDelegation: null,
  loading: false,
  setDelegations: (delegations) => set({ delegations }),
  setSubDelegation: (subDelegation) => set({ subDelegation }),
  setReDelegation: (reDelegation) => set({ reDelegation }),
  setLoading: (loading) => set({ loading }),
}))
