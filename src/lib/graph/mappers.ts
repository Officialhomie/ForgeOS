import type {
  GraphActivityEvent,
  GraphAgent,
  GraphDelegationNode,
  GraphTreasuryEvent,
  GraphTreasuryState,
} from '@/lib/graph/types'
import type {
  ActivityEvent,
  ActivityEventType,
  Address,
  Agent,
  AgentCategory,
  AgentId,
  AgentStatus,
  Delegation,
  DelegationHop,
  Hash,
  TreasuryState,
} from '@/types'

const NAME_TO_AGENT_ID: Record<string, AgentId> = {
  'DeFi Rebalancer': 'defi-rebalancer',
  'Payment Executor': 'payment-executor',
  'NFT Lifeguard': 'nft-lifeguard',
  'Data Broker': 'data-broker',
  'Social Poster': 'social-poster',
}

const DEFAULT_AGENT_META: Record<
  AgentId,
  { description: string; icon: string; category: AgentCategory }
> = {
  'defi-rebalancer': {
    description: 'Monitors and rebalances portfolio allocations',
    icon: 'TrendingUp',
    category: 'defi',
  },
  'payment-executor': {
    description: 'Executes recurring on-chain payments',
    icon: 'CreditCard',
    category: 'payments',
  },
  'nft-lifeguard': {
    description: 'Protects NFT floor positions',
    icon: 'Shield',
    category: 'nfts',
  },
  'data-broker': {
    description: 'Privacy-preserving data monetization',
    icon: 'Database',
    category: 'data',
  },
  'social-poster': {
    description: 'Automated social engagement',
    icon: 'Share2',
    category: 'social',
  },
}

function asAddress(value: string): Address {
  return value.toLowerCase() as Address
}

function asHash(value: string): Hash {
  const hex = value.startsWith('0x') ? value : `0x${value}`
  return hex as Hash
}

function slugFromName(name: string): AgentId {
  return (
    NAME_TO_AGENT_ID[name] ??
    (name.toLowerCase().replace(/\s+/g, '-') as AgentId)
  )
}

export function mapGraphDelegation(node: GraphDelegationNode): Delegation {
  const hop: DelegationHop =
    node.hopCount === 0 ? 'root' : node.hopCount === 1 ? 'sub' : 'redelegation'

  return {
    hash: asHash(node.hash),
    delegate: asAddress(node.delegatee),
    delegator: asAddress(node.delegator),
    authority: node.hopCount === 0 ? 'ROOT' : asHash(node.hash),
    caveats: [],
    salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
    signature:
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    hop,
    status: node.status === 'ACTIVE' ? 'active' : 'revoked',
    issuedAt: Number(node.createdAt),
    lastUsedAt: null,
    agentId: null,
    parentDelegation: null,
    children: [],
  }
}

export function mapGraphAgent(node: GraphAgent): Agent {
  const id = slugFromName(node.name)
  const meta = DEFAULT_AGENT_META[id] ?? {
    description: node.name,
    icon: 'Bot',
    category: 'defi' as AgentCategory,
  }

  const status: AgentStatus = node.active ? 'active' : 'inactive'

  return {
    id,
    name: node.name,
    description: meta.description,
    icon: meta.icon,
    category: meta.category,
    status,
    installedAt: Number(node.registeredAt),
    lastRunAt: node.totalRuns > 0 ? Number(node.registeredAt) : null,
    nextRunAt: null,
    runCount: node.totalRuns,
    successCount: node.successfulRuns,
    failureCount: Math.max(0, node.totalRuns - node.successfulRuns),
    delegation: null,
    redelegations: [],
    earningsLifetime: BigInt(node.totalSpent),
    earningsToday: 0n,
    gasSaved: 0n,
    config: {
      veniceModel: 'llama-3.3-70b',
      scheduleInterval: 86400,
      customInstructions: '',
    },
  }
}

export function mapGraphTreasury(
  state: GraphTreasuryState | null,
  events: GraphTreasuryEvent[],
  options: {
    chainId: number
    treasuryAddress: Address
    liveBalance?: bigint | null
    monthlyCap?: bigint
  },
): TreasuryState {
  const balance = options.liveBalance ?? BigInt(state?.balance ?? '0')
  const totalSpent = BigInt(state?.totalSpent ?? '0')
  const totalFunded = BigInt(state?.totalFunded ?? '0')
  const cap = options.monthlyCap ?? 500_000_000n
  const spent = totalSpent
  const percentUsed =
    cap > 0n ? Number((spent * 10000n) / cap) / 100 : 0

  const perAgent: Record<AgentId, bigint> = {
    'defi-rebalancer': 0n,
    'payment-executor': 0n,
    'nft-lifeguard': 0n,
    'data-broker': 0n,
    'social-poster': 0n,
  }

  for (const ev of events) {
    if (ev.eventType !== 'PAYMENT' || !ev.agentId) continue
    const id = slugFromName(ev.agentId.slice(0, 8))
    if (id in perAgent) {
      perAgent[id] = perAgent[id] + BigInt(ev.amount)
    }
  }

  const lastDistribution = events.find((e) => e.eventType === 'DISTRIBUTION')

  return {
    address: options.treasuryAddress,
    chainId: options.chainId,
    usdcBalance: balance,
    totalEarned: totalFunded,
    totalSpent,
    netProfit: balance,
    earningsBreakdown: {
      userShare: BigInt(lastDistribution?.userShare ?? '0'),
      treasuryShare: BigInt(lastDistribution?.refillShare ?? '0'),
      platformShare: BigInt(lastDistribution?.platformShare ?? '0'),
    },
    monthlyUsage: {
      spent,
      cap,
      percentUsed,
      perAgent,
    },
    autoTopUp: {
      enabled: false,
      thresholdUsdc: 50_000_000n,
      topUpAmountUsdc: 100_000_000n,
    },
  }
}

export function mapGraphActivity(node: GraphActivityEvent): ActivityEvent {
  const typeMap: Record<string, ActivityEventType> = {
    DELEGATION_GRANTED: 'delegation_issued',
    DELEGATION_REVOKED: 'delegation_revoked',
    PAYMENT_EXECUTED: 'subscription_payment',
    TREASURY_FUNDED: 'treasury_topup',
    AGENT_REGISTERED: 'os_activated',
    AGENT_DEACTIVATED: 'os_revoked',
    ALL_DELEGATIONS_REVOKED: 'os_revoked',
    REVENUE_DISTRIBUTED: 'treasury_topup',
  }

  return {
    id: node.id,
    type: typeMap[node.eventType] ?? 'agent_run_confirmed',
    agentId: node.agentId
      ? slugFromName(node.agentId.slice(0, 8))
      : null,
    title: node.eventType.replace(/_/g, ' '),
    description: node.description,
    amount: node.amount ? BigInt(node.amount) : null,
    txHash: asHash(node.txHash),
    delegationHash: node.delegationHash
      ? asHash(node.delegationHash)
      : null,
    timestamp: Number(node.timestamp),
    status: 'confirmed',
  }
}

export interface TreasuryPaymentRow {
  id: string
  payee: Address
  amount: bigint
  agentId: AgentId | null
  txHash: Hash
  timestamp: number
}

export function mapTreasuryPayments(
  events: GraphTreasuryEvent[],
): TreasuryPaymentRow[] {
  return events
    .filter((e) => e.eventType === 'PAYMENT')
    .map((e) => ({
      id: e.id,
      payee: asAddress(e.actor),
      amount: BigInt(e.amount),
      agentId: e.agentId ? slugFromName(e.agentId.slice(0, 8)) : null,
      txHash: asHash(e.txHash),
      timestamp: Number(e.timestamp),
    }))
}

export function aggregateDailyPayments(
  events: { amount: string; timestamp: string }[],
  days = 30,
): { date: string; total: bigint }[] {
  const now = Math.floor(Date.now() / 1000)
  const start = now - days * 86400
  const buckets = new Map<string, bigint>()

  for (let i = 0; i < days; i++) {
    const d = new Date((start + i * 86400) * 1000)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, 0n)
  }

  for (const ev of events) {
    const ts = Number(ev.timestamp)
    if (ts < start) continue
    const key = new Date(ts * 1000).toISOString().slice(0, 10)
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0n) + BigInt(ev.amount))
    }
  }

  return Array.from(buckets.entries()).map(([date, total]) => ({ date, total }))
}
