// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

export type Address = `0x${string}`
export type Hash = `0x${string}`
export type ChainId = number

// ─── OS STATE ─────────────────────────────────────────────────────────────────

export type OSStatus = 'inactive' | 'activating' | 'active' | 'revoking'

export interface OSKernelConfig {
  kernelAddress: Address
  treasuryAddress: Address
  registryAddress: Address
  deployedAt: number
  deployTxHash: Hash
  chainId: ChainId
}

// ─── POLICY ───────────────────────────────────────────────────────────────────

export type AgentCategory = 'defi' | 'payments' | 'nfts' | 'social' | 'data'

export interface Policy {
  monthlySpendCap: bigint
  allowedCategories: AgentCategory[]
  allowedTargets: Address[]
  maxSingleTxValue: bigint
  expiryTimestamp: number
}

// ─── DELEGATION ───────────────────────────────────────────────────────────────

export type DelegationHop = 'root' | 'sub' | 'redelegation'

export interface Caveat {
  enforcer: Address
  enforcerName: string
  terms: `0x${string}`
  decodedTerms: Record<string, unknown>
  humanReadable: string
}

export interface Delegation {
  hash: Hash
  delegate: Address
  delegator: Address
  authority: Hash | 'ROOT'
  caveats: Caveat[]
  salt: `0x${string}`
  signature: `0x${string}`
  hop: DelegationHop
  status: 'active' | 'revoked' | 'expired'
  issuedAt: number
  lastUsedAt: number | null
  agentId: string | null
  parentDelegation: Delegation | null
  children: Delegation[]
}

export interface DelegationRequest {
  delegate: Address
  parentDelegationHash: Hash | 'ROOT'
  caveats: Caveat[]
  humanSummary: string
}

// ─── AGENT ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'paused' | 'inactive' | 'running' | 'failed'

export type AgentId =
  | 'defi-rebalancer'
  | 'payment-executor'
  | 'nft-lifeguard'
  | 'data-broker'
  | 'social-poster'

export interface Agent {
  id: AgentId
  name: string
  description: string
  icon: string
  category: AgentCategory
  status: AgentStatus
  installedAt: number | null
  lastRunAt: number | null
  nextRunAt: number | null
  runCount: number
  successCount: number
  failureCount: number
  delegation: Delegation | null
  redelegations: Delegation[]
  earningsLifetime: bigint
  earningsToday: bigint
  gasSaved: bigint
  config: AgentConfig
}

export interface AgentConfig {
  veniceModel: string
  scheduleInterval: number
  customInstructions: string
  targetAllocations?: Record<string, number>
  rebalanceThreshold?: number
  subscriptionTargets?: Address[]
  floorAlertThreshold?: number
}

// ─── AGENT RUN ────────────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'reasoning'
  | 'planning'
  | 'executing'
  | 'confirmed'
  | 'failed'
  | 'reverted'

export interface AgentRun {
  id: string
  agentId: AgentId
  trigger: 'schedule' | 'command' | 'event'
  triggeredAt: number
  status: RunStatus
  veniceCall: VeniceCallRecord | null
  actionPlan: ActionPlan | null
  userOps: UserOpRecord[]
  oneShotTaskId: string | null
  confirmedAt: number | null
  failedAt: number | null
  failureReason: string | null
  gasSaved: bigint
  cost: bigint
  earnings: bigint
}

export interface VeniceCallRecord {
  model: string
  promptTokens: number
  completionTokens: number
  cost: bigint
  txHash: Hash | null
  completedAt: number
}

export interface UserOpRecord {
  userOpHash: Hash
  callTo: Address
  callData: `0x${string}`
  delegationHash: Hash
  status: 'pending' | 'confirmed' | 'failed'
  txHash: Hash | null
  blockNumber: bigint | null
  gasUsed: bigint | null
  gasSponsoredByOneShot: boolean
}

// ─── ACTION PLAN ──────────────────────────────────────────────────────────────

export interface ActionPlan {
  id: string
  intent: string
  summary: string
  actions: PlannedAction[]
  estimatedCost: bigint
  estimatedGas: bigint
  withinPolicy: boolean
  policyViolations: string[]
  generatedAt: number
  veniceModel: string
}

export type ActionType =
  | 'erc20_swap'
  | 'erc20_transfer'
  | 'stake'
  | 'unstake'
  | 'nft_buy'
  | 'nft_sell'
  | 'subscription_pay'
  | 'redelegate'
  | 'portfolio_read'

export interface PlannedAction {
  id: string
  type: ActionType
  agentId: AgentId
  delegationChain: Hash[]
  target: Address
  calldata: `0x${string}`
  value: bigint
  humanDescription: string
  estimatedOutput: string
  withinDelegationScope: boolean
  dependsOn: string[]
}

// ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export interface Subscription {
  id: string
  name: string
  description: string
  recipient: Address
  amount: bigint
  frequencySeconds: number
  maxPayments: number
  paymentsRemaining: number
  status: SubscriptionStatus
  delegation: Delegation
  nextPaymentAt: number
  lastPaymentAt: number | null
  lastPaymentTx: Hash | null
  createdAt: number
  agentId: AgentId
}

export interface SubscriptionPayment {
  subscriptionId: string
  amount: bigint
  txHash: Hash
  blockNumber: bigint
  timestamp: number
  status: 'confirmed' | 'failed'
  agentId: AgentId
}

// ─── TREASURY ─────────────────────────────────────────────────────────────────

export interface TreasuryState {
  address: Address
  chainId: ChainId
  usdcBalance: bigint
  totalEarned: bigint
  totalSpent: bigint
  netProfit: bigint
  earningsBreakdown: EarningsBreakdown
  monthlyUsage: MonthlyUsage
  autoTopUp: AutoTopUpConfig
}

export interface EarningsBreakdown {
  userShare: bigint
  treasuryShare: bigint
  platformShare: bigint
}

export interface MonthlyUsage {
  spent: bigint
  cap: bigint
  percentUsed: number
  perAgent: Record<AgentId, bigint>
}

export interface AutoTopUpConfig {
  enabled: boolean
  thresholdUsdc: bigint
  topUpAmountUsdc: bigint
}

export interface InferenceCostRecord {
  agentId: AgentId
  runId: string
  cost: bigint
  model: string
  timestamp: number
  txHash: Hash
}

// ─── ACTIVITY FEED ────────────────────────────────────────────────────────────

export type ActivityEventType =
  | 'agent_run_confirmed'
  | 'agent_run_failed'
  | 'delegation_issued'
  | 'delegation_revoked'
  | 'subscription_payment'
  | 'treasury_topup'
  | 'os_activated'
  | 'os_revoked'
  | 'command_executed'
  | 'kill_switch_failed'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  agentId: AgentId | null
  title: string
  description: string
  amount: bigint | null
  txHash: Hash | null
  delegationHash: Hash | null
  taskId?: string | null
  timestamp: number
  status: 'confirmed' | 'pending' | 'failed'
}

// ─── COMMAND / VENICE ─────────────────────────────────────────────────────────

export type CommandStatus =
  | 'idle'
  | 'reasoning'
  | 'planning'
  | 'executing'
  | 'confirmed'
  | 'failed'

export interface FlowTiming {
  flow: string
  totalMs: number
  steps: Record<string, number>
  checkpoints: Array<{ name: string; elapsedMs: number }>
}

export interface CommandState {
  status: CommandStatus
  intent: string
  streamingText: string
  actionPlan: ActionPlan | null
  runId: string | null
  oneShotTaskId: string | null
  error: string | null
  /** Machine-readable code from the last /api/command failure */
  errorCode: string | null
  /** Per-step latency from the last /api/command call */
  timing: FlowTiming | null
}

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DelegationSummary {
  agentId: AgentId
  delegationHash: Hash
  hop: DelegationHop
  caveatsHuman: string[]
}

export interface PortfolioSnapshot {
  timestamp: number
  balances: Record<string, string>
  totalValueUsd: string
}

export interface AgentCapabilitySummary {
  agentId: AgentId
  canExecute: boolean
  scopeDescription: string
}

export interface VeniceSystemContext {
  userAddress: Address
  smartAccountAddress: Address
  activeDelegations: DelegationSummary[]
  portfolioSnapshot: PortfolioSnapshot
  agentCapabilities: AgentCapabilitySummary[]
  policy: Policy
  /** Shared session for multi-hop A2A collaboration (Flow 8) */
  sessionId?: string
  priorHopSummary?: string
}

export interface VeniceRequest {
  model: string
  messages: VeniceMessage[]
  systemContext: VeniceSystemContext
}

// ─── 1SHOT ────────────────────────────────────────────────────────────────────

export type OneShotTaskStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Reverted'

export interface OneShotTask {
  taskId: string
  status: OneShotTaskStatus
  txHash: Hash | null
  submittedAt: number
  confirmedAt: number | null
  failureReason: string | null
}

export interface OneShotFeeData {
  gasPrice: bigint
  rate: bigint
  minFee: bigint
  convertedFee: bigint
  expiry: number
  context: string
}

export interface OneShotCapabilities {
  chainId: ChainId
  acceptedTokens: Address[]
  feeCollector: Address
  targetAddress: Address
}

// ─── WALLET ───────────────────────────────────────────────────────────────────

export interface WalletState {
  address: Address | null
  isConnected: boolean
  isSmartAccount: boolean
  chainId: ChainId | null
  eoaAddress: Address | null
}

// ─── STORE ACTIONS ────────────────────────────────────────────────────────────

export interface CreateSubscriptionParams {
  name: string
  description: string
  recipient: Address
  amount: bigint
  frequencySeconds: number
  maxPayments: number
}

// ─── API RESPONSE TYPES ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export type CommandErrorCode =
  | 'INSUFFICIENT_TREASURY'
  | 'VENICE_ERROR'
  | 'POLICY_VIOLATION'
  | 'UNKNOWN'

export type ExecuteErrorCode =
  | 'ONESHOT_ERROR'
  | 'DELEGATION_INVALID'
  | 'CAVEAT_VIOLATION'
  | 'UNKNOWN'

export interface CommandApiResponse {
  success: true
  actionPlan: ActionPlan
  streamUrl: string
  veniceModel: string
  cost: string
}

export interface CommandApiError {
  success: false
  error: string
  code: CommandErrorCode
}

export interface ExecuteApiResponse {
  success: true
  taskId: string
  userOpHashes: Hash[]
  estimatedConfirmation: number
}

export interface ExecuteApiError {
  success: false
  error: string
  code: ExecuteErrorCode
}

export interface OneShotWebhookPayload {
  taskId: string
  status: OneShotTaskStatus
  txHash?: Hash
  failureReason?: string
  signature: string
}

// ─── ERC-4337 / DELEGATION FRAMEWORK ─────────────────────────────────────────

/** ModeCode for redeemDelegations() — DEFAULT = single call execution */
export type ModeCode = `0x${string}`

/** AgentConfig extended with runtime trigger fields (Phase 4) */
export interface AgentRuntimeConfig extends AgentConfig {
  enabled: boolean
  intervalSeconds: number
  lastTriggeredAt: number | null
  triggerType: 'cron' | 'manual' | 'event'
}
