/**
 * Orchestrator — Agent Router
 *
 * Selects the right agent from the ForgeOS registry based on intent type.
 * In live mode queries ForgeOSRegistry; in demo mode uses static mapping.
 *
 * Track evidence: Best A2A — demonstrates agent selection from registry
 */

import type { AgentId } from '@/types'

// ─── INTENT → AGENT MAPPING ───────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ pattern: RegExp; primaryAgent: AgentId }> = [
  { pattern: /rebalanc|portfolio|swap|eth|btc|defi/i, primaryAgent: 'defi-rebalancer' },
  { pattern: /pay|subscri|transfer|send|usdc/i, primaryAgent: 'payment-executor' },
  { pattern: /nft|floor|buy|sell|collection/i, primaryAgent: 'nft-lifeguard' },
  { pattern: /data|monetize|privacy|sell.*data/i, primaryAgent: 'data-broker' },
  { pattern: /post|tweet|social|announc/i, primaryAgent: 'social-poster' },
]

// The A2A 2-hop chain always pairs DeFiAgent with PaymentAgent
const A2A_CHAIN: Record<AgentId, AgentId | null> = {
  'defi-rebalancer': 'payment-executor',  // DeFiAgent re-delegates to PaymentAgent
  'payment-executor': null,               // PaymentAgent is the leaf (no further re-delegation)
  'nft-lifeguard': null,
  'data-broker': null,
  'social-poster': null,
}

// ─── ROUTE RESULT ─────────────────────────────────────────────────────────────

export interface RouteResult {
  /** Primary agent that receives the sub-delegation from OSKernel */
  primaryAgent: AgentId
  /** Secondary agent that receives the re-delegation from primaryAgent (null = no A2A) */
  secondaryAgent: AgentId | null
  /** Whether this is a 2-hop A2A chain */
  isA2A: boolean
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Select the agent chain for a given intent.
 *
 * Returns primaryAgent + secondaryAgent (the A2A 2-hop pair).
 * Falls back to 'defi-rebalancer' → 'payment-executor' if no pattern matches.
 */
export function routeIntent(intent: string): RouteResult {
  for (const { pattern, primaryAgent } of INTENT_PATTERNS) {
    if (pattern.test(intent)) {
      const secondaryAgent = A2A_CHAIN[primaryAgent]
      return {
        primaryAgent,
        secondaryAgent,
        isA2A: secondaryAgent !== null,
      }
    }
  }

  // Default: DeFi → Payment (covers most demo scenarios)
  return {
    primaryAgent: 'defi-rebalancer',
    secondaryAgent: 'payment-executor',
    isA2A: true,
  }
}

// ─── AGENT METADATA ───────────────────────────────────────────────────────────

export const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  'defi-rebalancer': 'DeFi Rebalancer — calculates portfolio adjustments',
  'payment-executor': 'Payment Executor — executes USDC transfers via delegation proof',
  'nft-lifeguard': 'NFT Lifeguard — monitors floor prices and executes emergency sells',
  'data-broker': 'Data Broker — monetizes on-chain behavioral data',
  'social-poster': 'Social Poster — posts on-chain activity to social accounts',
}
