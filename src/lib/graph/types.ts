export type GraphDelegationStatus = 'ACTIVE' | 'REVOKED'

export interface GraphCaveat {
  enforcerName: string
  termsParsed: string | null
}

export interface GraphDelegationNode {
  id: string
  hash: string
  delegator: string
  delegatee: string
  hopCount: number
  status: GraphDelegationStatus
  createdAt: string
  caveats?: GraphCaveat[]
  children?: GraphDelegationNode[]
}

export interface GraphAgent {
  id: string
  agentId: string
  name: string
  endpoint: string
  active: boolean
  totalRuns: number
  successfulRuns: number
  totalSpent: string
  registeredAt: string
}

export interface GraphTreasuryState {
  balance: string
  totalFunded: string
  totalSpent: string
  lastUpdatedAt: string
}

export interface GraphTreasuryEvent {
  id: string
  eventType: 'FUNDED' | 'PAYMENT' | 'DISTRIBUTION'
  amount: string
  actor: string
  agentId: string | null
  txHash: string
  timestamp: string
  userShare?: string | null
  refillShare?: string | null
  platformShare?: string | null
}

export interface GraphActivityEvent {
  id: string
  eventType: string
  actor: string
  agentId: string | null
  delegationHash: string | null
  description: string
  amount: string | null
  txHash: string
  timestamp: string
}

export interface GraphDailySpend {
  date: string
  total: string
}
