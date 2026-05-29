import type { Address } from '@/types'

function envAddress(key: string, fallback: Address): Address {
  const v = process.env[key]
  if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) return v as Address
  return fallback
}

/** Circle USDC on Ethereum Sepolia (11155111) */
const DEFAULT_USDC_ETH_SEPOLIA =
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address

/** USDC on Base mainnet (Venice x402) */
const DEFAULT_USDC_BASE_MAINNET =
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address

export const CONTRACTS = {
  osKernel: envAddress(
    'NEXT_PUBLIC_OS_KERNEL_ADDRESS',
    '0xa4bD3e0946431dFA0C38F700f5935E03b749C77C' as Address,
  ),
  agentTreasury: envAddress(
    'NEXT_PUBLIC_AGENT_TREASURY_ADDRESS',
    '0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429' as Address,
  ),
  registry: envAddress(
    'NEXT_PUBLIC_REGISTRY_ADDRESS',
    '0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68' as Address,
  ),
  /** USDC on primary Forge chain (Ethereum Sepolia by default). */
  usdc: envAddress('NEXT_PUBLIC_USDC_ADDRESS', DEFAULT_USDC_ETH_SEPOLIA),
  /** @deprecated Use usdc */
  usdcSepolia: envAddress(
    'NEXT_PUBLIC_USDC_SEPOLIA_ADDRESS',
    DEFAULT_USDC_ETH_SEPOLIA,
  ),
  /** USDC on Base mainnet for Venice x402. */
  usdcBase: envAddress('NEXT_PUBLIC_USDC_BASE_ADDRESS', DEFAULT_USDC_BASE_MAINNET),
} as const
