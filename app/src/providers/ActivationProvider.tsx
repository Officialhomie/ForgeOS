'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useActivation } from '@/hooks/useActivation'

type ActivationContextValue = ReturnType<typeof useActivation>

const ActivationContext = createContext<ActivationContextValue | null>(null)

export function ActivationProvider({ children }: { children: ReactNode }) {
  const value = useActivation()
  return (
    <ActivationContext.Provider value={value}>
      {children}
    </ActivationContext.Provider>
  )
}

export function useActivationContext(): ActivationContextValue {
  const ctx = useContext(ActivationContext)
  if (!ctx) {
    throw new Error('useActivationContext must be used within ActivationProvider')
  }
  return ctx
}
