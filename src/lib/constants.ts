import type { ChainId } from '@/types'

export const SEPOLIA_CHAIN_ID = 11155111 satisfies ChainId
export const BASE_CHAIN_ID = 8453 satisfies ChainId

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: 'LayoutDashboard' },
  { href: '/dashboard/agents', label: 'Agents', icon: 'Bot' },
  { href: '/dashboard/delegations', label: 'Delegations', icon: 'GitBranch' },
  { href: '/dashboard/treasury', label: 'Treasury', icon: 'Wallet' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: 'Repeat' },
] as const

// ─── VENICE AI ────────────────────────────────────────────────────────────────

export const VENICE = {
  BASE_URL: process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1',
  DEFAULT_MODEL: 'llama-3.3-70b',
  EMBEDDINGS_MODEL: 'text-embedding-ada-002',
} as const

// ─── 1SHOT RELAY ─────────────────────────────────────────────────────────────

export const ONESHOT = {
  CHAIN_ID: parseInt(process.env.ONESHOT_CHAIN_ID ?? '11155111', 10) as ChainId,
  RELAYER_URL: process.env.ONESHOT_RELAYER_URL ?? 'https://relayer.1shotapi.com/relayers',
} as const

// ─── APP ──────────────────────────────────────────────────────────────────────

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
