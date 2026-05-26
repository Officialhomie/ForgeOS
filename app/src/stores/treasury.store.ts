'use client'

import { create } from 'zustand'
import type { TreasuryState } from '@/types'

interface TreasuryStore {
  treasury: TreasuryState | null
  loading: boolean
  setTreasury: (treasury: TreasuryState | null) => void
  setLoading: (loading: boolean) => void
}

export const useTreasuryStore = create<TreasuryStore>((set) => ({
  treasury: null,
  loading: false,
  setTreasury: (treasury) => set({ treasury }),
  setLoading: (loading) => set({ loading }),
}))
