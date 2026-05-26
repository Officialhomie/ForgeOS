import type { ChainId } from '@/types'

/**
 * ForgeOS primary testnet = Ethereum Sepolia (11155111).
 * Used for contracts, ERC-7715 delegations (Flask), 1Shot relay, and wallet UX.
 * Venice x402 production traffic uses Base mainnet (8453) via VENICE_CHAIN_ID.
 */

function parseChainId(raw: string | undefined, fallback: number): ChainId {
  const n = raw ? parseInt(raw, 10) : fallback
  if (!Number.isFinite(n)) return fallback as ChainId
  return n as ChainId
}

/**
 * Primary app + deploy chain.
 * Default: Ethereum Sepolia (11155111) — required for ERC-7715 Flask and 1Shot relay.
 * Override via NEXT_PUBLIC_CHAIN_ID if you switch to Base Sepolia (84532) for contracts.
 */
export const FORGE_CHAIN_ID = parseChainId(
  process.env.NEXT_PUBLIC_CHAIN_ID ?? process.env.ONESHOT_CHAIN_ID,
  11155111,
)

/** Venice / agent-wallet chain (default Base mainnet for live x402). */
export const VENICE_CHAIN_ID = parseChainId(
  process.env.VENICE_CHAIN_ID ?? process.env.NEXT_PUBLIC_VENICE_CHAIN_ID,
  8453,
)

export const CHAIN_NAMES: Record<number, string> = {
  84532: 'Base Sepolia',
  8453: 'Base',
  11155111: 'Ethereum Sepolia',
}

export function chainDisplayName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
}

/** @deprecated Use FORGE_CHAIN_ID */
export const ACTIVATION_CHAIN_ID = FORGE_CHAIN_ID
