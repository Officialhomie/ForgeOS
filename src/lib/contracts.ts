import type { Address } from '@/types'

function envAddress(key: string, fallback: Address): Address {
  const v = process.env[key]
  if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) return v as Address
  return fallback
}

export const CONTRACTS = {
  osKernel: envAddress(
    'NEXT_PUBLIC_OS_KERNEL_ADDRESS',
    '0xOSKernel000000000000000000000000000000000' as Address,
  ),
  agentTreasury: envAddress(
    'NEXT_PUBLIC_AGENT_TREASURY_ADDRESS',
    '0xTreasury00000000000000000000000000000000' as Address,
  ),
  registry: envAddress(
    'NEXT_PUBLIC_REGISTRY_ADDRESS',
    '0xRegistry000000000000000000000000000000000' as Address,
  ),
  usdcSepolia: envAddress(
    'NEXT_PUBLIC_USDC_SEPOLIA_ADDRESS',
    '0x1c7D4C196Cb0C7B01d743Fbc6116a902379C7238' as Address,
  ),
  usdcBase: envAddress(
    'NEXT_PUBLIC_USDC_BASE_ADDRESS',
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
  ),
} as const
