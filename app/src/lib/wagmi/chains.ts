import { defineChain } from 'viem'
import { sepolia as viemSepolia, base as viemBase } from 'viem/chains'
import { VENICE_CHAIN_ID } from '@/lib/chains/network'

const forgeRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  'https://rpc.ankr.com/eth_sepolia'

/** Primary ForgeOS testnet — Ethereum Sepolia (11155111). Required for ERC-7715 Flask. */
export const forgeChain = defineChain({
  ...viemSepolia,
  rpcUrls: {
    default: { http: [forgeRpc] },
  },
})

/** Venice x402 (default Base mainnet 8453). */
export const veniceChain = defineChain({
  ...viemBase,
  id: VENICE_CHAIN_ID,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_BASE_RPC_URL ?? 'https://mainnet.base.org'],
    },
  },
})

/** @deprecated Use forgeChain */
export const sepolia = forgeChain

/** @deprecated Use veniceChain */
export const base = veniceChain

/** @deprecated Use forgeChain */
export const ethSepolia = forgeChain

export const supportedChains = [forgeChain] as const
export type SupportedChain = (typeof supportedChains)[number]
