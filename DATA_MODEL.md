# Data Model — TypeScript Types, Store Shape, API Contracts
**Product:** ForgeOS
**Version:** 1.1
**Date:** May 27, 2026
**Source of truth:** `app/src/types/index.ts`, `app/src/stores/*.store.ts`
**Related:** [TRD.md](./TRD.md) | [APP_FLOW.md](./APP_FLOW.md)

---

## Core Domain Types

### Primitives

```ts
type Address = `0x${string}`
type Hash = `0x${string}`
type ChainId = number
```

### OS State

```ts
type OSStatus = 'inactive' | 'activating' | 'active' | 'revoking'

interface OSKernelConfig {
  kernelAddress: Address
  treasuryAddress: Address
  registryAddress: Address
  deployedAt: number
  deployTxHash: Hash
  chainId: ChainId
}
```

### Policy

```ts
type AgentCategory = 'defi' | 'payments' | 'nfts' | 'social' | 'data'

interface Policy {
  monthlySpendCap: bigint       // 500_000_000n = 500 USDC
  allowedCategories: AgentCategory[]
  allowedTargets: Address[]
  maxSingleTxValue: bigint
  expiryTimestamp: number
}
```

### Delegation

```ts
type DelegationHop = 'root' | 'sub' | 'redelegation'

interface Caveat {
  enforcer: Address
  enforcerName: string
  terms: `0x${string}`
  decodedTerms: Record<string, unknown>
  humanReadable: string         // e.g. "Max 500 USDC per call"
}

interface Delegation {
  hash: Hash
  delegate: Address
  delegator: Address
  authority: Hash | 'ROOT'      // 'ROOT' = bytes32(0) for root delegations
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

interface DelegationRequest {
  delegate: Address
  parentDelegationHash: Hash | 'ROOT'
  caveats: Caveat[]
  humanSummary: string
}
```

### Agent

```ts
type AgentStatus = 'active' | 'paused' | 'inactive' | 'running' | 'failed'

type AgentId =
  | 'defi-rebalancer'
  | 'payment-executor'
  | 'nft-lifeguard'
  | 'data-broker'
  | 'social-poster'

interface Agent {
  id: AgentId
  name: string
  description: string
  icon: string                  // Lucide icon name
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

// Current (in types/index.ts)
interface AgentConfig {
  veniceModel: string
  scheduleInterval: number
  customInstructions: string
  targetAllocations?: Record<string, number>
  rebalanceThreshold?: number
  subscriptionTargets?: Address[]
  floorAlertThreshold?: number
}

// Extended type needed for Phase 4 (add to types/index.ts)
interface AgentRuntimeConfig extends AgentConfig {
  enabled: boolean
  intervalSeconds: number       // maps to scheduleInterval but explicit
  lastTriggeredAt: number | null
  triggerType: 'cron' | 'manual' | 'event'
}
```

### Agent Run

```ts
type RunStatus =
  | 'pending'
  | 'reasoning'
  | 'planning'
  | 'executing'
  | 'confirmed'
  | 'failed'
  | 'reverted'

interface AgentRun {
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

interface VeniceCallRecord {
  model: string
  promptTokens: number
  completionTokens: number
  cost: bigint
  txHash: Hash | null           // x402 payment tx on Base
  completedAt: number
}

interface UserOpRecord {
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
```

### Action Plan

```ts
interface ActionPlan {
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

type ActionType =
  | 'erc20_swap'
  | 'erc20_transfer'
  | 'stake'
  | 'unstake'
  | 'nft_buy'
  | 'nft_sell'
  | 'subscription_pay'
  | 'redelegate'
  | 'portfolio_read'

interface PlannedAction {
  id: string
  type: ActionType
  agentId: AgentId
  delegationChain: Hash[]        // ordered: [rootHash, subHash, reHash]
  target: Address
  calldata: `0x${string}`
  value: bigint
  humanDescription: string
  estimatedOutput: string
  withinDelegationScope: boolean
  dependsOn: string[]            // action IDs this depends on
}
```

### Subscription

```ts
type SubscriptionStatus = 'active' | 'paused' | 'completed' | 'cancelled'

interface Subscription {
  id: string
  name: string
  description: string
  recipient: Address
  amount: bigint                 // USDC, 6 decimals
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

interface SubscriptionPayment {
  subscriptionId: string
  amount: bigint
  txHash: Hash
  blockNumber: bigint
  timestamp: number
  status: 'confirmed' | 'failed'
  agentId: AgentId
}
```

### Treasury

```ts
interface TreasuryState {
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

interface EarningsBreakdown {
  userShare: bigint              // USER_BPS = 8000 (80%)
  treasuryShare: bigint          // REFILL_BPS = 1500 (15%)
  platformShare: bigint          // PLATFORM_FEE_BPS = 500 (5%)
}

interface MonthlyUsage {
  spent: bigint
  cap: bigint                    // Policy.monthlySpendCap
  percentUsed: number
  perAgent: Record<AgentId, bigint>
}

interface AutoTopUpConfig {
  enabled: boolean
  thresholdUsdc: bigint
  topUpAmountUsdc: bigint
}
```

### Activity Feed

```ts
type ActivityEventType =
  | 'agent_run_confirmed'
  | 'agent_run_failed'
  | 'delegation_issued'
  | 'delegation_revoked'
  | 'subscription_payment'
  | 'treasury_topup'
  | 'os_activated'
  | 'os_revoked'
  | 'command_executed'

interface ActivityEvent {
  id: string
  type: ActivityEventType
  agentId: AgentId | null
  title: string
  description: string
  amount: bigint | null
  txHash: Hash | null
  delegationHash: Hash | null
  timestamp: number
  status: 'confirmed' | 'pending' | 'failed'
}
```

### Command / Venice

```ts
type CommandStatus =
  | 'idle'
  | 'reasoning'
  | 'planning'
  | 'executing'
  | 'confirmed'
  | 'failed'

interface CommandState {
  status: CommandStatus
  intent: string
  streamingText: string
  actionPlan: ActionPlan | null
  runId: string | null
  oneShotTaskId: string | null
  error: string | null
}

interface VeniceMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface VeniceSystemContext {
  userAddress: Address
  smartAccountAddress: Address
  activeDelegations: DelegationSummary[]
  portfolioSnapshot: PortfolioSnapshot
  agentCapabilities: AgentCapabilitySummary[]
  policy: Policy
}
```

### 1Shot

```ts
type OneShotTaskStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Reverted'

interface OneShotTask {
  taskId: string
  status: OneShotTaskStatus
  txHash: Hash | null
  submittedAt: number
  confirmedAt: number | null
  failureReason: string | null
}
```

### Builder / Marketplace (NEW — Phase 5/6)

```ts
type ConfigFieldType = 'text' | 'number' | 'address' | 'select' | 'toggle' | 'addressList'

interface ConfigField {
  label: string
  type: ConfigFieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: string[]
  description?: string
  required?: boolean
}

interface CaveatTemplate {
  enforcerName: string
  enforcer: Address
  description: string
  defaultTerms: Record<string, unknown>
}

interface AgentTemplate {
  id: AgentId
  name: string
  description: string
  category: AgentCategory
  defaultPrompt: string
  defaultCaveats: CaveatTemplate[]
  defaultIntervalSeconds: number
  configSchema: Record<string, ConfigField>
}

interface MarketplaceAgent {
  agentId: string               // on-chain registry ID
  name: string
  description: string
  category: AgentCategory
  creator: Address
  agentAddress: Address
  ipfsUri: string
  registeredAt: number
  totalInstalls: number
  isActive: boolean
  caveatTemplate: CaveatTemplate[]
  promptTemplate: string
  configSchema: Record<string, ConfigField>
}

// Extends ModeCode for redeemDelegations encoding (Phase 1)
type ModeCode = `0x${string}`
const MODE_DEFAULT: ModeCode = '0x0000000000000000000000000000000000000000000000000000000000000000'
```

---

## Zustand Store Shapes

### `os.store`
**File:** `app/src/stores/os.store.ts`

```ts
interface OSStore {
  osStatus: OSStatus                          // 'inactive' | 'activating' | 'active' | 'revoking'
  osKernel: OSKernelConfig | null
  rootDelegation: Delegation | null
  policy: Policy | null
  activationStep: number                      // 0–4
  setOsStatus: (status: OSStatus) => void
  setKernel: (kernel: OSKernelConfig | null) => void
  setRootDelegation: (delegation: Delegation | null) => void
  setPolicy: (policy: Policy | null) => void
  setActivationStep: (step: number) => void
}
```
**Persistence:** localStorage via `lib/activation/storage.ts`

---

### `delegations.store`
**File:** `app/src/stores/delegations.store.ts`

```ts
// Current
interface DelegationsStore {
  delegations: Delegation[]
  loading: boolean
  setDelegations: (delegations: Delegation[]) => void
  setLoading: (loading: boolean) => void
}

// Phase 2 additions (needed for A2A):
interface DelegationsStore {
  delegations: Delegation[]
  subDelegation: Delegation | null            // OSKernel → DeFiAgent
  reDelegation: Delegation | null             // DeFiAgent → PaymentAgent
  loading: boolean
  setDelegations: (delegations: Delegation[]) => void
  setSubDelegation: (d: Delegation | null) => void
  setReDelegation: (d: Delegation | null) => void
  setLoading: (loading: boolean) => void
}
```
**Persistence:** localStorage

---

### `agents.store`
**File:** `app/src/stores/agents.store.ts`

```ts
// Current
interface AgentsStore {
  agents: Record<AgentId, Agent>
  selectedAgentId: AgentId | null
  loading: boolean
  setAgents: (agents: Record<AgentId, Agent>) => void
  setSelectedAgentId: (id: AgentId | null) => void
  setLoading: (loading: boolean) => void
}

// Phase 4 additions:
interface AgentsStore {
  agents: Record<AgentId, Agent>
  agentConfigs: Record<AgentId, AgentRuntimeConfig>   // runtime trigger config
  selectedAgentId: AgentId | null
  loading: boolean
  setAgents: (agents: Record<AgentId, Agent>) => void
  setAgentConfig: (id: AgentId, config: AgentRuntimeConfig) => void
  setSelectedAgentId: (id: AgentId | null) => void
  setLoading: (loading: boolean) => void
}
```
**Persistence:** In-memory (re-initialized from constants on page load)

---

### `treasury.store`
**File:** `app/src/stores/treasury.store.ts`

```ts
interface TreasuryStore {
  treasury: TreasuryState | null
  loading: boolean
  setTreasury: (treasury: TreasuryState | null) => void
  setLoading: (loading: boolean) => void
}
```
**Persistence:** In-memory (re-fetched from The Graph / RPC on load)

---

### `activity.store`
**File:** `app/src/stores/activity.store.ts`

```ts
interface ActivityStore {
  activityFeed: ActivityEvent[]               // capped at 50 events (newest first)
  lastUpdated: number | null
  setActivityFeed: (events: ActivityEvent[]) => void
  pushActivity: (event: ActivityEvent) => void  // prepends, slices to 50
}
```
**Persistence:** In-memory

---

### `command.store`
**File:** `app/src/stores/command.store.ts`

```ts
interface CommandStore {
  isOpen: boolean
  command: CommandState
  pendingPlan: ActionPlan | null
  setOpen: (isOpen: boolean) => void
  setCommand: (command: Partial<CommandState>) => void
  setPendingPlan: (plan: ActionPlan | null) => void
  resetCommand: () => void
}
```
**Persistence:** In-memory (resets when modal closes)

---

## API Request / Response Contracts

### `POST /api/command`
```ts
// Request
{ intent: string; systemContext: VeniceSystemContext }

// Response (success)
{
  success: true
  actionPlan: ActionPlan & { estimatedCost: string; estimatedGas: string }
  streamUrl: string           // '/api/events'
  veniceModel: string
  cost: string                // bigint as string
}

// Response (error)
{
  success: false
  error: string
  code: 'INSUFFICIENT_TREASURY' | 'VENICE_ERROR' | 'POLICY_VIOLATION' | 'UNKNOWN'
}
```

### `POST /api/execute`
```ts
// Request
{
  actionPlan: ActionPlan & { estimatedCost: string; estimatedGas: string }
  signedDelegations?: Delegation[]
  userAddress?: string
  chainId?: ChainId
}

// Response (success)
{
  success: true
  taskId: string
  userOpHashes: Hash[]
  estimatedConfirmation: number  // seconds
}
```

### `POST /api/a2a/execute`
```ts
// Request
{
  intent: string
  rootDelegationHash: Hash
  subDelegationHash: Hash
  reDelegationHash: Hash
  signedDelegations?: Delegation[]
  userAddress?: string
}

// Response (success)
{
  success: true
  taskId: string
  plan: ActionPlan (serialised)
  primaryAgent: AgentId
  secondaryAgent: AgentId
  isA2A: boolean
  hops: number
}
```

### `POST /api/relay/revoke-all`
```ts
// Request: empty body

// Response
{ success: boolean; taskId?: string; error?: string }
```

### `POST /api/relay/fund`
```ts
// Request
{ amountUsdc: string; treasuryAddress?: string; chainId?: number }

// Response
{ taskId: string; status: 'submitted' }
```

### `POST /api/webhooks/1shot`
```ts
// Incoming payload (from 1Shot)
{
  taskId: string
  status: 'Pending' | 'Confirmed' | 'Rejected' | 'Reverted'
  txHash?: Hash
  failureReason?: string
  signature: string              // Ed25519 hex
}

// Response: 200 OK or 401 Unauthorized
```

### `POST /api/registry/publish` (Phase 6)
```ts
// Request
{
  name: string
  description: string
  category: AgentCategory
  promptTemplate: string
  caveatTemplate: CaveatTemplate[]
  agentAddress: Address
  configSchema?: Record<string, ConfigField>
}

// Response
{
  success: boolean
  agentId?: string
  ipfsUri?: string
  taskId?: string
  error?: string
}
```

### `GET /api/registry/agents` (Phase 6)
```ts
// Response
{
  success: boolean
  agents: MarketplaceAgent[]
}
```

### `POST /api/agents/run` (Phase 4)
```ts
// Request
{
  agentId: AgentId
  intent: string
  rootDelegationHash: Hash
  subDelegationHash: Hash
  reDelegationHash: Hash
}

// Response
{ success: boolean; taskId?: string; error?: string }
```

---

## Constants

```ts
// lib/constants.ts
export const VENICE = {
  BASE_URL: process.env.VENICE_BASE_URL ?? 'https://api.venice.ai/api/v1',
  DEFAULT_MODEL: 'llama-3.3-70b',
  EMBEDDINGS_MODEL: 'text-embedding-ada-002',
} as const

export const ONESHOT = {
  CHAIN_ID: parseInt(process.env.ONESHOT_CHAIN_ID ?? '11155111') as ChainId,
  RELAYER_URL: process.env.ONESHOT_RELAYER_URL ?? 'https://relayer.1shotapi.com/relayers',
} as const

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
```

```ts
// lib/contracts.ts (derive from CHAINS.md)
export const CONTRACTS = {
  osKernel: '0xcFC6BECB0054D6e313a88c70CcE1d477D8752382',
  agentTreasury: '0xe0DD408BE8cb3Dfe6441FEfE1e209E886F48071A',
  registry: '0x4668B4Dd600FB4404783a9C73B6b4fcb71e78347',
  usdcSepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  usdcBase: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
} as const
```

---

## Mock Data Structure

Demo data is intentionally disabled (`hydrateDemoStores` is a no-op). When demo mode is re-enabled:

**Location:** `app/src/lib/demo.ts` — `isDemoMode()` reads `NEXT_PUBLIC_DEMO_MODE`
**Hydration:** `app/src/stores/hydrate-demo.ts` — populates all stores with seed data

**Seed data shape per store:**
- `os.store`: `osStatus: 'active'`, mock kernelConfig, mock rootDelegation
- `delegations.store`: 3 mock delegations (root, sub, re) with realistic caveats
- `agents.store`: 5 agents with mixed statuses, recent run history
- `treasury.store`: balance $432.50, usage 86% of $500 cap
- `activity.store`: 5 recent events (2 confirmed, 1 pending, 1 failed, 1 subscription)

To re-enable demo mode:
1. Set `NEXT_PUBLIC_DEMO_MODE=true`
2. Populate `hydrate-demo.ts` with seed data
3. `isDemoMode()` returns `true`
4. `ActivationGuard` bypasses redirect

---

## Graph (Subgraph) Types

```ts
// lib/graph/types.ts
interface GraphTreasuryState {
  id: string
  balance: string
  totalSpent: string
  totalRefilled: string
}

interface GraphTreasuryEvent {
  id: string
  type: 'ExecutePayment' | 'Fund' | 'Refill'
  amount: string
  timestamp: string
  txHash: string
}
```

**Queries:** `lib/graph/queries.ts` — `GET_TREASURY_SUMMARY`, `GET_DAILY_PAYMENTS`
**Client:** `lib/graph/client.ts` — `queryGraph<T>(query, vars)` with graceful fallback
**Enabled:** `NEXT_PUBLIC_GRAPH_URL` env var must be set (optional)
