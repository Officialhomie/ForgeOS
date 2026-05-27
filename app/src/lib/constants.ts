import type { ChainId } from '@/types'
import { FORGE_CHAIN_ID, VENICE_CHAIN_ID } from '@/lib/chains/network'

/** Primary testnet (Base Sepolia by default). */
export const FORGE_CHAIN_ID_EXPORT = FORGE_CHAIN_ID satisfies ChainId

/** @deprecated Use FORGE_CHAIN_ID_EXPORT */
export const SEPOLIA_CHAIN_ID = FORGE_CHAIN_ID_EXPORT

/** Venice / x402 chain (Base mainnet by default). */
export const BASE_CHAIN_ID = VENICE_CHAIN_ID satisfies ChainId

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { href: '/dashboard/agents', label: 'Agents', icon: 'Bot' },
  { href: '/dashboard/delegations', label: 'Delegations', icon: 'GitBranch' },
  { href: '/dashboard/treasury', label: 'Treasury', icon: 'Wallet' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: 'Repeat' },
  { href: '/dashboard/builder', label: 'Builder', icon: 'Hammer' },
  { href: '/dashboard/status', label: 'Status', icon: 'Activity' },
  { href: '/marketplace', label: 'Marketplace', icon: 'Store' },
] as const

export const VENICE = {
  BASE_URL: process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1',
  DEFAULT_MODEL: 'llama-3.3-70b',
  EMBEDDINGS_MODEL: 'text-embedding-ada-002',
} as const

export const ONESHOT = {
  CHAIN_ID: parseInt(process.env.ONESHOT_CHAIN_ID ?? String(FORGE_CHAIN_ID), 10) as ChainId,
  RELAYER_URL: process.env.ONESHOT_RELAYER_URL ?? 'https://relayer.1shotapi.com/relayers',
} as const

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
