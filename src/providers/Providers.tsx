'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { useState, type ReactNode } from 'react'
import { wagmiConfig } from '@/lib/wagmi/config'
import { ZustandHydration } from '@/providers/ZustandHydration'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZustandHydration>{children}</ZustandHydration>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
