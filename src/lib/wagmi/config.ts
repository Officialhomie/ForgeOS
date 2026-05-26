'use client'

import { createConfig, http } from 'wagmi'
import { injected, metaMask } from 'wagmi/connectors'
import { sepolia, base } from './chains'

export const wagmiConfig = createConfig({
  chains: [sepolia, base],
  connectors: [
    metaMask(),
    injected({ target: 'metaMask' }),
  ],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org',
    ),
    [base.id]: http(
      process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
    ),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
