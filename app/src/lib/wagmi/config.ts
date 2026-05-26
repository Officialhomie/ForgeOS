'use client'

import { createConfig, http } from 'wagmi'
import { sepolia } from 'viem/chains'
import { metaMask } from 'wagmi/connectors'
import { forgeChain } from './chains'

const rpcUrl =
  forgeChain.rpcUrls.default.http[0] ??
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  'https://rpc.ankr.com/eth_sepolia'

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'ForgeOS',
        url: appUrl,
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
