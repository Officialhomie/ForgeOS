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

/**
 * MetaMask Delegation Framework caveat enforcers on Ethereum Sepolia (11155111).
 *
 * Source: contracts/lib/delegation-framework/broadcast/DeployCaveatEnforcers.s.sol/11155111/
 * (official framework deployment broadcasts). Each address verified on-chain via
 * `cast code` — see CHAINS.md "Sepolia Enforcers" section for the verification record.
 */
export const SEPOLIA_ENFORCERS = {
  erc20TransferAmount: '0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc' as Address,
  allowedMethods: '0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5' as Address,
  allowedTargets: '0x7F20f61b1f09b08D970938F6fa563634d65c4EeB' as Address,
  limitedCalls: '0x04658B29F6b82ed55274221a06Fc97D318E25416' as Address,
  timestamp: '0x1046bb45C8d673d4ea75321280DB34899413c069' as Address,
  blockNumber: '0x5d9818dF0AE3f66e9c3D0c5029DAF99d1823ca6c' as Address,
} as const
