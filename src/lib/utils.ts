import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Address, Hash, ChainId, Delegation, AgentId } from '@/types'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── ADDRESS ──────────────────────────────────────────────────────────────────

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function isValidAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

// ─── USDC FORMATTING ──────────────────────────────────────────────────────────

const USDC_DECIMALS = 6n
const USDC_DIVISOR = 10n ** USDC_DECIMALS

export function formatUsdc(amount: bigint, decimals = 2): string {
  const whole = amount / USDC_DIVISOR
  const fraction = amount % USDC_DIVISOR
  const fractionStr = fraction.toString().padStart(6, '0').slice(0, decimals)
  return `$${whole.toLocaleString()}.${fractionStr}`
}

export function formatUsdcRaw(amount: bigint): string {
  return amount.toString()
}

export function parseUsdc(value: string): bigint {
  const [whole, fraction = ''] = value.replace(/[$,]/g, '').split('.')
  const paddedFraction = fraction.slice(0, 6).padEnd(6, '0')
  return BigInt(whole) * USDC_DIVISOR + BigInt(paddedFraction)
}

// ─── TIME FORMATTING ──────────────────────────────────────────────────────────

export function timeAgo(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 86400 * 365) return `${Math.floor(diff / (86400 * 30))}mo ago`
  return `${Math.floor(diff / (86400 * 365))}y ago`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatExpiry(timestamp: number): string {
  const date = formatDate(timestamp)
  const now = Math.floor(Date.now() / 1000)
  const diff = timestamp - now
  if (diff < 0) return `${date} (expired)`
  const days = Math.floor(diff / 86400)
  return `${date} (in ${days} days)`
}

// ─── CAVEAT DISPLAY ───────────────────────────────────────────────────────────

export function parseCaveat(caveat: {
  enforcerName: string
  humanReadable: string
  decodedTerms?: Record<string, unknown>
}): string {
  if (caveat.humanReadable) return caveat.humanReadable
  return caveat.enforcerName.replace(/Enforcer$/, '')
}

// ─── DELEGATION HELPERS ───────────────────────────────────────────────────────

export function buildDelegationTree(delegations: Delegation[]): Delegation | null {
  const root = delegations.find((d) => d.authority === 'ROOT') ?? null
  if (!root) return null

  const nodeMap = new Map<Hash, Delegation>(
    delegations.map((d) => [d.hash, { ...d, children: [] }]),
  )

  for (const del of delegations) {
    if (del.authority !== 'ROOT') {
      const parent = nodeMap.get(del.authority as Hash)
      if (parent) {
        parent.children = [...parent.children, nodeMap.get(del.hash)!]
      }
    }
  }

  return nodeMap.get(root.hash) ?? null
}

export function getRootDelegation(delegations: Delegation[]): Delegation | null {
  return delegations.find((d) => d.authority === 'ROOT' && d.status === 'active') ?? null
}

export function getAgentDelegation(
  delegations: Delegation[],
  agentId: AgentId,
): Delegation | null {
  return (
    delegations.find((d) => d.agentId === agentId && d.status === 'active') ?? null
  )
}

// ─── EXPLORER LINKS ───────────────────────────────────────────────────────────

const EXPLORER_BASE: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
  8453: 'https://basescan.org',
}

export function explorerTxUrl(hash: Hash, chainId: ChainId): string {
  const base = EXPLORER_BASE[chainId] ?? 'https://etherscan.io'
  return `${base}/tx/${hash}`
}

export function explorerAddressUrl(address: Address, chainId: ChainId): string {
  const base = EXPLORER_BASE[chainId] ?? 'https://etherscan.io'
  return `${base}/address/${address}`
}

// ─── POLICY HELPERS ───────────────────────────────────────────────────────────

export function policyToHumanSummary(policy: {
  monthlySpendCap: bigint
  allowedCategories: string[]
  maxSingleTxValue: bigint
  expiryTimestamp: number
}): string {
  const cap = formatUsdc(policy.monthlySpendCap)
  const maxTx = formatUsdc(policy.maxSingleTxValue)
  const categories = policy.allowedCategories.join(', ')
  const expiry = formatExpiry(policy.expiryTimestamp)
  return `${cap}/month cap · max ${maxTx}/tx · categories: ${categories} · expires ${expiry}`
}

// ─── MISC ─────────────────────────────────────────────────────────────────────

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
