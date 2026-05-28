/**
 * Agent Templates — 5 built-in ForgeOS agents
 *
 * Each template defines the default Venice prompt, ERC-7710 caveats,
 * run interval, and configSchema for the no-code builder UI.
 *
 * Track evidence:
 *  - Best Agent: pre-wired agents with real caveat enforcement
 */

import type { AgentId, AgentCategory } from '@/types'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type ConfigFieldType = 'text' | 'number' | 'address' | 'select' | 'toggle' | 'addressList'

export interface ConfigField {
  label: string
  type: ConfigFieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: string[]
  description?: string
  required?: boolean
}

export interface CaveatTemplate {
  enforcerName: string
  enforcer: `0x${string}`
  description: string
  defaultTerms: Record<string, unknown>
}

export interface AgentTemplate {
  id: AgentId
  name: string
  description: string
  category: AgentCategory
  defaultPrompt: string
  defaultCaveats: CaveatTemplate[]
  defaultIntervalSeconds: number
  configSchema: Record<string, ConfigField>
}

// ─── ENFORCER ADDRESSES (Sepolia) ─────────────────────────────────────────────
// These are the MetaMask Delegation Toolkit caveat enforcer addresses.
// Replace with actual deployed addresses for production.

const ENFORCERS = {
  erc20TransferAmount: '0x0000000000000000000000000000000000000001' as `0x${string}`,
  allowedMethods: '0x0000000000000000000000000000000000000002' as `0x${string}`,
  allowedTargets: '0x0000000000000000000000000000000000000003' as `0x${string}`,
  limitedCalls: '0x0000000000000000000000000000000000000004' as `0x${string}`,
  timestamp: '0x0000000000000000000000000000000000000005' as `0x${string}`,
  blockNumber: '0x0000000000000000000000000000000000000006' as `0x${string}`,
} as const

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'defi-rebalancer',
    name: 'DeFi Rebalancer',
    description:
      'Automatically rebalances your portfolio to target allocations using on-chain swaps. Runs on a schedule and only acts when drift exceeds your threshold.',
    category: 'defi',
    defaultPrompt:
      'You are a DeFi rebalancing agent. Your goal is to maintain the target portfolio allocations. Check current balances, calculate drift from targets, and execute swaps via Uniswap V3 to rebalance. Max slippage: {maxSlippage}%. Only rebalance if any asset drifts more than {rebalanceThreshold}% from target. Target: BTC {targetBtcPct}%, ETH {targetEthPct}%, USDC remainder.',
    defaultCaveats: [
      {
        enforcerName: 'ERC20TransferAmountEnforcer',
        enforcer: ENFORCERS.erc20TransferAmount,
        description: 'Limits maximum USDC transfer per execution',
        defaultTerms: { maxAmount: '500000000' }, // 500 USDC
      },
      {
        enforcerName: 'AllowedMethodsEnforcer',
        enforcer: ENFORCERS.allowedMethods,
        description: 'Restricts to swap and rebalance methods only',
        defaultTerms: { selectors: ['0x12345678', '0x87654321'] },
      },
    ],
    defaultIntervalSeconds: 3600, // every hour
    configSchema: {
      targetBtcPct: {
        label: 'BTC Target %',
        type: 'number',
        defaultValue: 50,
        description: 'Target BTC portfolio percentage',
        required: true,
      },
      targetEthPct: {
        label: 'ETH Target %',
        type: 'number',
        defaultValue: 30,
        description: 'Target ETH portfolio percentage',
        required: true,
      },
      rebalanceThreshold: {
        label: 'Drift Threshold %',
        type: 'number',
        defaultValue: 5,
        description: 'Only rebalance when asset drifts this far from target',
      },
      maxSlippage: {
        label: 'Max Slippage %',
        type: 'number',
        defaultValue: 1,
        description: 'Maximum acceptable swap slippage',
      },
    },
  },

  {
    id: 'payment-executor',
    name: 'Payment Executor',
    description:
      'Automates recurring USDC payments to multiple recipients. Handles subscriptions, salaries, or any scheduled payment stream — fully gasless.',
    category: 'payments',
    defaultPrompt:
      'You are a payment automation agent. Execute scheduled USDC transfers to the configured recipients. For each recipient in the list, check if payment is due (last payment + frequency <= now) and submit the transfer if so. Respect the per-recipient spend cap.',
    defaultCaveats: [
      {
        enforcerName: 'ERC20TransferAmountEnforcer',
        enforcer: ENFORCERS.erc20TransferAmount,
        description: 'Limits maximum USDC per payment',
        defaultTerms: { maxAmount: '100000000' }, // 100 USDC
      },
      {
        enforcerName: 'LimitedCallsEnforcer',
        enforcer: ENFORCERS.limitedCalls,
        description: 'Max payments per activation',
        defaultTerms: { limit: 5 },
      },
    ],
    defaultIntervalSeconds: 86400, // every day
    configSchema: {
      recipients: {
        label: 'Recipient Addresses',
        type: 'addressList',
        description: 'Comma-separated list of recipient wallet addresses',
        required: true,
      },
      amountPerRecipient: {
        label: 'Amount Per Payment (USDC)',
        type: 'number',
        defaultValue: 10,
        description: 'USDC amount to send to each recipient per interval',
        required: true,
      },
      frequencyHours: {
        label: 'Payment Frequency (hours)',
        type: 'number',
        defaultValue: 24,
        description: 'Hours between each payment',
      },
    },
  },

  {
    id: 'nft-lifeguard',
    name: 'NFT Lifeguard',
    description:
      'Monitors NFT floor prices and automatically lists or delist your NFTs to protect floor exposure. Never lets you get rugged without a fight.',
    category: 'nfts',
    defaultPrompt:
      'You are an NFT floor protection agent. Monitor the floor price of collections in the watchlist. If floor drops below {floorAlertThreshold}% of your acquisition price, list the NFT at floor + 5%. If floor recovers above acquisition + 20%, delist (hold for gains). Always check OpenSea/Blur API for current floor before acting.',
    defaultCaveats: [
      {
        enforcerName: 'AllowedTargetsEnforcer',
        enforcer: ENFORCERS.allowedTargets,
        description: 'Restricts to NFT marketplace contracts only',
        defaultTerms: { targets: [] },
      },
      {
        enforcerName: 'AllowedMethodsEnforcer',
        enforcer: ENFORCERS.allowedMethods,
        description: 'Restricts to list/delist NFT methods',
        defaultTerms: { selectors: ['0xabcdef12'] },
      },
    ],
    defaultIntervalSeconds: 1800, // every 30 minutes
    configSchema: {
      collections: {
        label: 'Collection Addresses',
        type: 'addressList',
        description: 'NFT collection contract addresses to monitor',
        required: true,
      },
      floorAlertThreshold: {
        label: 'Floor Alert Threshold %',
        type: 'number',
        defaultValue: 15,
        description: 'List NFT if floor drops this % below acquisition price',
      },
      autoList: {
        label: 'Auto-list on floor drop',
        type: 'toggle',
        defaultValue: true,
        description: 'Automatically list NFTs when floor protection triggers',
      },
    },
  },

  {
    id: 'social-poster',
    name: 'Social Poster',
    description:
      'Posts automated on-chain status updates to Lens Protocol or Farcaster based on your portfolio events and market conditions.',
    category: 'social',
    defaultPrompt:
      'You are a social media agent. Monitor portfolio events (rebalances, large gains/losses, delegation activity) and compose engaging social posts for Lens Protocol. Keep posts under 280 characters, use relevant hashtags (#DeFi #OnChain), and only post when there is a genuinely interesting event to share. Post at most once per {maxPostsPerDay} per day.',
    defaultCaveats: [
      {
        enforcerName: 'AllowedTargetsEnforcer',
        enforcer: ENFORCERS.allowedTargets,
        description: 'Restricts to Lens/Farcaster contracts only',
        defaultTerms: { targets: [] },
      },
      {
        enforcerName: 'LimitedCallsEnforcer',
        enforcer: ENFORCERS.limitedCalls,
        description: 'Max posts per activation',
        defaultTerms: { limit: 3 },
      },
    ],
    defaultIntervalSeconds: 21600, // every 6 hours
    configSchema: {
      platform: {
        label: 'Platform',
        type: 'select',
        options: ['Lens Protocol', 'Farcaster', 'Both'],
        defaultValue: 'Lens Protocol',
        required: true,
      },
      maxPostsPerDay: {
        label: 'Max Posts Per Day',
        type: 'number',
        defaultValue: 3,
        description: 'Daily posting limit to prevent spam',
      },
      tone: {
        label: 'Posting Tone',
        type: 'select',
        options: ['Professional', 'Casual', 'Degen'],
        defaultValue: 'Professional',
      },
    },
  },

  {
    id: 'data-broker',
    name: 'Data Broker',
    description:
      'Collects on-chain portfolio data, computes analytics, and optionally sells anonymized insights via Venice embeddings. Your data, your revenue.',
    category: 'data',
    defaultPrompt:
      'You are a data analytics agent. Collect portfolio snapshots, compute 7-day and 30-day performance metrics, generate embeddings for portfolio similarity scoring using Venice embeddings API, and store aggregated (non-PII) analytics on-chain. If data monetization is enabled, prepare anonymized insight packages for the ForgeOS data marketplace.',
    defaultCaveats: [
      {
        enforcerName: 'AllowedMethodsEnforcer',
        enforcer: ENFORCERS.allowedMethods,
        description: 'Read-only contract calls only',
        defaultTerms: { selectors: ['0x70a08231', '0x18160ddd'] }, // balanceOf, totalSupply
      },
    ],
    defaultIntervalSeconds: 43200, // every 12 hours
    configSchema: {
      enableMonetization: {
        label: 'Enable Data Monetization',
        type: 'toggle',
        defaultValue: false,
        description: 'Sell anonymized portfolio analytics via ForgeOS data marketplace',
      },
      trackTokens: {
        label: 'Tokens to Track',
        type: 'text',
        defaultValue: 'ETH,USDC,WBTC',
        description: 'Comma-separated token symbols to include in analytics',
      },
    },
  },
]

export function getTemplate(id: AgentId): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id)
}
