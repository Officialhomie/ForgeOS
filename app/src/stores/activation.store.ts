'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ActivationPhase, ActivationStepId } from '@/types/activation'
import type { Address, Hash } from '@/types'

// ─── Per-wallet state shape ────────────────────────────────────────────────

export interface WalletActivationState {
  phase: ActivationPhase
  completedSteps: ActivationStepId[]
  smartAccountAddress: Address | null
  delegationHash: Hash | null
  deployTxHash: Hash | null
  fundTxHash: Hash | null
  oneShotTaskId: string | null
}

export const INITIAL_WALLET: WalletActivationState = {
  phase: 'idle',
  completedSteps: [],
  smartAccountAddress: null,
  delegationHash: null,
  deployTxHash: null,
  fundTxHash: null,
  oneShotTaskId: null,
}

// ─── Store shape ───────────────────────────────────────────────────────────

/**
 * All activation state is keyed by wallet address (lowercase).
 * Each wallet gets its own isolated slice — switching wallets never
 * leaks state between accounts.
 *
 * The persist key is 'forgeos-activation-v2' to avoid conflicts with
 * the old flat format stored under 'forgeos-activation'.
 */
interface ActivationStore {
  wallets: Record<string, WalletActivationState>

  /** Get the stored state for a wallet, falling back to INITIAL_WALLET. */
  getWallet: (address: string) => WalletActivationState

  /**
   * Merge a partial update into a wallet's state.
   * Creates the wallet entry from INITIAL_WALLET if it doesn't exist yet.
   */
  patchWallet: (address: string, patch: Partial<WalletActivationState>) => void

  /** Add a completed step (idempotent — won't duplicate). */
  addWalletStep: (address: string, step: ActivationStepId) => void

  /** Reset a wallet's state back to INITIAL_WALLET. */
  resetWallet: (address: string) => void
}

export const useActivationStore = create<ActivationStore>()(
  persist(
    (set, get) => ({
      wallets: {},

      getWallet: (address) => {
        const key = address.toLowerCase()
        return get().wallets[key] ?? { ...INITIAL_WALLET }
      },

      patchWallet: (address, patch) => {
        const key = address.toLowerCase()
        set((s) => ({
          wallets: {
            ...s.wallets,
            [key]: { ...(s.wallets[key] ?? INITIAL_WALLET), ...patch },
          },
        }))
      },

      addWalletStep: (address, step) => {
        const key = address.toLowerCase()
        set((s) => {
          const current = s.wallets[key] ?? INITIAL_WALLET
          if (current.completedSteps.includes(step)) return s
          return {
            wallets: {
              ...s.wallets,
              [key]: {
                ...current,
                completedSteps: [...current.completedSteps, step],
              },
            },
          }
        })
      },

      resetWallet: (address) => {
        const key = address.toLowerCase()
        set((s) => ({
          wallets: { ...s.wallets, [key]: { ...INITIAL_WALLET } },
        }))
      },
    }),
    {
      name: 'forgeos-activation-v2',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
