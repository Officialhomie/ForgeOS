import { defineChain } from 'viem'
import { sepolia as viemSepolia, base as viemBase } from 'viem/chains'

// Sepolia — delegation, kernel, ERC-7715 Snaps
export const sepolia = defineChain({
  ...viemSepolia,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org',
      ],
    },
  },
})

// Base — Venice x402 payments, AgentTreasury USDC
export const base = defineChain({
  ...viemBase,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org',
      ],
    },
  },
})

export const supportedChains = [sepolia, base] as const
export type SupportedChain = (typeof supportedChains)[number]
