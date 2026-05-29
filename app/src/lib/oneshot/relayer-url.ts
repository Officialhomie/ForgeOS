import { FORGE_CHAIN_ID } from '@/lib/chains/network'

/** Testnets served by the 1Shot dev relayer (see public-relayer skill). */
const DEV_RELAYER_CHAINS = new Set([11155111, 84532])

export const ONESHOT_RELAYER_PROD = 'https://relayer.1shotapi.com/relayers'
export const ONESHOT_RELAYER_DEV = 'https://relayer.1shotapi.dev/relayers'

/**
 * Resolve JSON-RPC relayer URL.
 * - `ONESHOT_RELAYER_URL` overrides everything (use .dev for Sepolia, .com for mainnet).
 * - Default: dev relayer for Ethereum Sepolia / Base Sepolia; prod for mainnets.
 */
export function resolveRelayerUrl(chainId?: number): string {
  const override = process.env.ONESHOT_RELAYER_URL?.trim()
  if (override) return override

  const id = chainId ?? FORGE_CHAIN_ID
  return DEV_RELAYER_CHAINS.has(id) ? ONESHOT_RELAYER_DEV : ONESHOT_RELAYER_PROD
}
