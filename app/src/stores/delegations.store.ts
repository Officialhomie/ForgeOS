'use client'

import { create } from 'zustand'
import type { Delegation } from '@/types'

interface DelegationsStore {
  delegations: Delegation[]
  loading: boolean
  setDelegations: (delegations: Delegation[]) => void
  setLoading: (loading: boolean) => void
}

export const useDelegationsStore = create<DelegationsStore>((set) => ({
  delegations: [],
  loading: false,
  setDelegations: (delegations) => set({ delegations }),
  setLoading: (loading) => set({ loading }),
}))
