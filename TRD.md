# Technical Requirements Document (TRD)
**Product:** ForgeOS
**Version:** 1.1
**Date:** May 27, 2026
**Related:** [PRD.md](./PRD.md) | [APP_FLOW.md](./APP_FLOW.md) | [UI_SPEC.md](./UI_SPEC.md) | [DATA_MODEL.md](./DATA_MODEL.md) | [IMPL.md](./IMPL.md)

---

## Operational Flows

This document specifies all 12 core operational flows of ForgeOS. Each flow maps directly to a demo scenario and a prize track. Every section includes the exact functions, API methods, contract calls, and chain targets used.

---

## Flow 1 — OS Activation (4-Step Wizard)

**Track:** Best Agent (permissions UX), Best x402+ERC-7710

**Precondition:** MetaMask Flask installed, user on Sepolia (11155111), no existing activation.

**Step 1 — Connect Wallet**
- `useActivation` hook detects MetaMask Flask via `window.ethereum.isMetaMask` + Flask UA check
- Dual-extension detection: if both regular MetaMask and Flask are installed, show error and block
- `connect()` calls `wagmi.connect()` with MetaMask connector
- `useOsStore` updates `osStatus → 'activating'`
- Activation state persisted to `localStorage` via `lib/activation/storage.ts`

**Step 2 — Deploy Smart Account**
- Calls `POST /api/relay/deploy`
- Server-side: `send7710Transaction({ chainId: 11155111, userOps: [deployOp] })`
- The deploy UserOp encodes `OSKernel.initialize(owner, treasuryAddress, registryAddress)`
- Returns `{ taskId, kernelAddress }` immediately
- Webhook at `/api/webhooks/1shot` fires when confirmed
- `useActivation` polls `taskStore.get(taskId)` until status `Confirmed`
- Stores `kernelAddress`, `treasuryAddress`, `deployTxHash` in `os.store`

**Step 3 — Request Execution Permissions (ERC-7715)**
- Calls `buildActivationPermissions(kernelAddress)` from `lib/activation/permissions.ts`
- Returns scoped permission object: monthly cap $500 USDC, allowed categories, 1-year expiry
- Injects `erc7715ProviderActions` into wallet client via `@metamask/smart-accounts-kit`
- Calls `walletClient.requestExecutionPermissions(permissions)`
- MetaMask Flask shows scoped approval UI — user approves
- Returns signed `ERC-7710 delegation` (authority = ROOT, delegate = OSKernel address)
- Delegation stored in `delegations.store` as root delegation
- Delegation hash stored in `os.store.rootDelegationHash`

**Step 4 — Fund Treasury**
- Calls `POST /api/relay/fund` with initial USDC amount
- Server encodes `AgentTreasury.fund(amount)` calldata
- Submits via 1Shot; webhook confirms
- `treasury.store` updated with confirmed balance

**Completion:** `osStatus → 'active'`, `activationStep = 4`, persisted to localStorage.

---

## Flow 2 — Venice AI x402 Inference

**Track:** Best Venice AI, Best x402+ERC-7710

**Precondition:** `AGENT_WALLET_KEY` configured, USDC balance on Base mainnet (chain 8453).

**Step 1 — SIWE Authentication (24h cache)**
- `VeniceClient.getSiweToken()` checks `siweTokenCache` (in-memory, 24h TTL)
- If expired: constructs SIWE message, signs with `AGENT_WALLET_KEY` via viem `signMessage`
- POST to `${VENICE_BASE_URL}/api/v1/auth/wallet` with `{ message, signature }`
- Returns `{ token }`, cached with timestamp

**Step 2 — Chat Completion Request**
- POST to `${VENICE_BASE_URL}/api/v1/chat/completions`
- Headers: `Authorization: Bearer ${siweToken}`, `X-Sign-In-With-Ethereum: ${siweToken}`
- Body: `{ model: 'llama-3.3-70b', messages, stream: false }`

**Step 3 — 401 Handling (SIWE refresh)**
- On 401 response: clear `siweTokenCache`, re-authenticate, retry request once
- If second 401: throw `VeniceAuthError`

**Step 4 — 402 Handling (x402 micropayment)**
- On 402 response: parse `WWW-Authenticate` header for payment details
- Extract: `amount`, `asset` (USDC), `chainId` (8453), `to` (Venice payment receiver)
- Execute USDC transfer: `writeContract({ abi: ERC20_ABI, functionName: 'transfer', args: [to, amount], chainId: 8453 })`
- Wait for transaction receipt
- Encode receipt as base64: `btoa(JSON.stringify({ txHash, chainId, amount }))`
- Add header: `X-Payment: ${encoded}`
- Retry original request
- If second 402: throw `VenicePaymentError`

**Step 5 — Embeddings (multi-endpoint track)**
- `VeniceClient.embeddings({ input: text, model: 'text-embedding-ada-002' })`
- POST to `${VENICE_BASE_URL}/api/v1/embeddings`
- Called in background (non-blocking) after every A2A intent execution

---

## Flow 3 — 1Shot Relay Transaction

**Track:** Best 1Shot Relayer (webhook > polling)

**Precondition:** `ONESHOT_API_KEY` configured, chain 11155111.

**Step 1 — Get Capabilities**
- `relayer_getCapabilities(["11155111"])` on `https://relayer.1shotapi.dev/relayers`
- Returns: `{ "11155111": { tokens, feeCollector, targetAddress } }`
- Payment token from `tokens[0]` (never hardcoded)

**Step 2 — Get Fee Data**
- `relayer_getFeeData({ chainId: "11155111", token })`
- Returns: `{ gasPrice, rate, minFee, expiry, context }`
- `context` string passed back in send call (required)

**Step 3 — Send Transaction**
- `relayer_send7710Transaction({ chainId, transactions, context, destinationUrl })`
- Each transaction: `{ permissionContext, executions }` (fee USDC transfer + work call)
- `destinationUrl` = `${APP_URL}/api/webhooks/1shot` (required for webhook score)
- Returns `{ taskId }` immediately

**Step 4 — Webhook Confirmation (NOT polling)**
- 1Shot POST to `${destinationUrl}` when tx confirmed
- Payload: `{ taskId, status, txHash?, failureReason?, signature }`
- `signature` verified via Ed25519 against `ONESHOT_WEBHOOK_SECRET`
- `taskStore.update(taskId, status, txHash)` called
- `activityEmitter.emitActivity(event)` fires SSE to all connected clients

**Step 5 — SSE Delivery to Client**
- Client listens on `GET /api/events` (SSE stream)
- 15-second keep-alive ping: `event: ping\ndata: {}\n\n`
- Activity event delivered: `data: ${JSON.stringify(event)}\n\n`

---

## Flow 4 — ERC-7715 Permission Request

**Track:** Best Agent (permission UX is CENTRAL)

**Precondition:** MetaMask Flask active, on Sepolia.

**Building Permission Object**
```ts
buildActivationPermissions(kernelAddress: Address): ExecutionPermission {
  return {
    chainId: 11155111,
    expiry: Math.floor(Date.now() / 1000) + 365 * 86400,  // 1 year
    signer: { type: 'account', data: { id: kernelAddress } },
    permissions: [
      {
        type: 'native-token-transfer',
        data: { allowance: '500000000' },      // 500 USDC (6 decimals)
        required: true,
      },
      {
        type: 'erc20-token-transfer',
        data: {
          address: USDC_SEPOLIA,
          allowance: '500000000',
        },
        required: true,
      },
    ],
  }
}
```

**Triggering MetaMask Flask**
- `walletClient.requestExecutionPermissions(permission)` via `erc7715ProviderActions`
- MetaMask Flask shows human-readable approval UI
- User approves → returns signed ERC-7710 delegation struct

**Storing the Result**
- Delegation parsed: `{ hash, delegate, delegator, authority: 'ROOT', caveats, signature }`
- Stored in `delegations.store.delegations[0]` (root delegation)
- `os.store.rootDelegationHash` = delegation hash
- Activation step advances to `4`

---

## Flow 5 — A2A 2-Hop Orchestration

**Track:** Best A2A Coordination (2+ hop chain), Best Venice AI

**Precondition:** Root, sub, and re-delegation hashes available. Venice client authenticated.

**Step 1 — Intent Parsing (Venice)**
```
parseA2AIntent(intent, delegationHashes) → ActionPlan
```
- System prompt: includes all 3 delegation hashes, policy, agent capabilities
- Venice response: JSON `{ summary, actions: [hop1, hop2] }`
- `hop1.agentId = 'defi-rebalancer'`, `hop1.delegationChain = [subHash]`
- `hop2.agentId = 'payment-executor'`, `hop2.delegationChain = [subHash, reHash]`
- Fallback: if Venice returns malformed JSON, use hardcoded 2-hop swap+pay plan

**Step 2 — Action Graph Build + Validate**
```
buildActionGraph(plan) → TopologicalOrder
validateActionGraph(plan) → string[]  // empty = valid
```
- Validates each action has non-empty `delegationChain`
- Validates `dependsOn` references exist in plan
- Returns topologically sorted action list

**Step 3 — UserOp Construction**
```
buildUserOps({ actions, signedDelegations, senderAddress }) → UserOp[]
```
- One UserOp per action
- Each `UserOp.delegationProofs` = signed delegation objects matching `delegationChain` hashes
- `callData` currently = `action.calldata` (Phase 1 upgrades to `redeemDelegations()` encoding)

**Step 4 — 1Shot Submission**
- Same as Flow 3, Steps 3-5

---

## Flow 6 — Sub-Delegation Chain Creation

**Track:** Best A2A Coordination (precondition for A2A)

**Precondition:** Root delegation exists in store.

**Sub-delegation (OSKernel → DeFiAgent)**
```ts
createSubDelegationStruct(rootDelegation, defiAgentAddress) → Delegation
```
- `authority` = root delegation hash
- `delegate` = DeFiAgent address (`NEXT_PUBLIC_DEFI_AGENT_ADDRESS`)
- Caveats:
  - `ERC20TransferAmountEnforcer`: max 500 USDC per call
  - `AllowedMethodsEnforcer`: only `swap()`, `rebalance()` selectors
  - `TimestampEnforcer`: valid until 1 year from now
- `salt` = random 32-byte hex
- No wallet signature needed — created server-side by OSKernel

**Re-delegation (DeFiAgent → PaymentAgent)**
```ts
createReDelegationStruct(subDelegation, paymentAgentAddress) → Delegation
```
- `authority` = sub-delegation hash
- `delegate` = PaymentAgent address (`NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS`)
- Caveats:
  - `ERC20TransferAmountEnforcer`: max 100 USDC (narrowed from parent's 500)
  - `LimitedCallsEnforcer`: max 1 call per activation
- Sub-delegation can only NARROW parent scope — never widen

**Storage**
- `delegations.store.subDelegation` = subDelegation object
- `delegations.store.reDelegation` = reDelegation object
- `delegations.store.delegations` = [...existing, subDelegation, reDelegation]

---

## Flow 7 — Command Bar Full Pipeline

**Track:** Best Agent, Best A2A

**Precondition:** OS active, sub-delegations created.

1. User types intent in CommandBar → `CommandState.status → 'reasoning'`
2. POST `/api/command` with `{ intent, systemContext }` → Venice returns `ActionPlan`
3. Client reads delegation hashes from store: `rootHash`, `subHash`, `reHash`
4. If A2A intent (plan.actions.length >= 2): POST `/api/a2a/execute` with all 3 hashes + signedDelegations
5. If single intent: POST `/api/execute` with signedDelegations
6. Receive `{ taskId }` → `CommandState.status → 'executing'`
7. SSE event fires when 1Shot webhook confirms → `CommandState.status → 'confirmed'`
8. Display tx hash + plan summary in CommandBar

---

## Flow 8 — Webhook → SSE Delivery

**Track:** Best 1Shot Relayer

**Webhook Verification**
```ts
// POST /api/webhooks/1shot
const sig = request.headers.get('x-oneshot-signature')  // Ed25519 hex
const body = await request.text()
const valid = await ed25519.verify(sig, body, ONESHOT_WEBHOOK_PUBLIC_KEY)
if (!valid) return 401
```

**Task Store Update**
```ts
taskStore.update(taskId, status, txHash)
// Backed by in-memory Map<string, OneShotTask>
```

**SSE Emission**
```ts
activityEmitter.emitActivity(activityEvent)
// EventEmitter → all open /api/events connections → client update
```

**Client SSE Consumer**
```ts
// useActivityStream hook
const es = new EventSource('/api/events')
es.onmessage = (e) => {
  const event = JSON.parse(e.data) as ActivityEvent
  activityStore.addActivity(event)
}
```

---

## Flow 9 — Kill Switch

**Track:** Best Agent (emergency revoke UX)

**Precondition:** OS active, active delegations in store.

1. User clicks Kill Switch button in TopBar
2. `useKillSwitch.revokeAll()` called
3. Optimistic UI: all delegations immediately marked `status: 'revoked'` in Zustand
4. POST `/api/relay/revoke-all`
5. Server encodes: `encodeFunctionData({ abi: OS_KERNEL_ABI, functionName: 'revokeAll' })`
6. Submits via 1Shot: `send7710Transaction({ userOps: [{ callData: encoded, target: kernelAddress }] })`
7. Returns `{ taskId }`
8. If success: `isRevoked = true`, kill switch UI shows confirmed state
9. If webhook `Rejected`: restore delegation snapshot, show error
10. All sub-delegations die atomically in OSKernel via `revokeAll()` on-chain

---

## Flow 10 — Subscription Payment

**Track:** Best x402+ERC-7710 (streaming/recurring payments)

**Creating a Subscription**
- POST `/api/subscriptions/create` with `{ name, recipient, amount, frequencySeconds, maxPayments }`
- Creates delegation with `LimitedCallsEnforcer` (max N calls) + `TimestampEnforcer` (expiry)
- Registers via `ERC-7715` or uses existing sub-delegation
- Stores in `subscription.store`

**Executing a Payment**
- POST `/api/subscriptions/execute` with `{ subscriptionId }`
- Encodes `AgentTreasury.executePayment(recipient, amount, agentId, proof)` calldata
- Submits via 1Shot (gasless)
- Venice x402 loop pays for inference if reasoning step needed

---

## Flow 11 — Autonomous Agent Runtime

**Track:** Best Agent (runs while you sleep)

**Cron Trigger (Vercel Cron, every 5 minutes)**
```
GET /api/cron/agent-runner
Authorization: Bearer ${CRON_SECRET}
```
- Reads enabled agents from `AGENT_CONFIGS` env / store
- For each enabled agent with `nextRunAt <= now`: POST `/api/agents/run`
- Fires and forgets (responds 200 immediately)

**Per-Agent Execution**
```
POST /api/agents/run
{ agentId, intent, rootDelegationHash, subDelegationHash, reDelegationHash }
```
- Calls `orchestrate({ intent, ...hashes })` → Venice ActionPlan
- Builds UserOps → sends via 1Shot
- Returns `{ taskId }`
- Agent `lastTriggeredAt` updated in store

---

## Flow 12 — Treasury Top-Up

**Track:** Best x402+ERC-7710

**User Trigger**
- TopUpModal input: USDC amount
- POST `/api/relay/fund` with `{ amountUsdc, treasuryAddress }`
- Server encodes: `encodeFunctionData({ abi: AGENT_TREASURY_ABI, functionName: 'fund', args: [BigInt(amount)] })`
- Submits via 1Shot relay
- Webhook confirms → `treasury.store.usdcBalance` updated

---

## Section 13 — ERC-4337 UserOp Construction Spec

### Problem
The delegation framework requires UserOps to encode `redeemDelegations()` calldata. Sending raw action calldata directly to 1Shot bypasses the ERC-7710 delegation enforcement on-chain.

### `redeemDelegations` ABI Fragment
```ts
export const DELEGATOR_CORE_ABI = [
  {
    name: 'redeemDelegations',
    type: 'function',
    inputs: [
      {
        name: 'permissionContexts',
        type: 'bytes[][]',
        // Each element is an array of ABI-encoded delegation structs (one per hop)
      },
      {
        name: 'modes',
        type: 'bytes32[]',
        // Single call mode = ModeCode.DEFAULT
      },
      {
        name: 'executionCallDatas',
        type: 'bytes[]',
        // ABI-encoded execution: encodeAbiParameters([target, value, calldata])
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
```

### ModeCode Values
```ts
export const ModeCode = {
  DEFAULT: '0x0000000000000000000000000000000000000000000000000000000000000000',
  BATCHED: '0x0100000000000000000000000000000000000000000000000000000000000000',
} as const
```

### Encoding Pattern
```ts
import { encodeFunctionData, encodeAbiParameters } from 'viem'

function encodeRedeemDelegations(
  delegations: Delegation[],  // ordered chain: [root, sub, re]
  innerTarget: Address,
  innerCalldata: Hex,
  innerValue: bigint,
): Hex {
  // 1. ABI-encode each delegation struct
  const encodedDelegations = delegations.map(encodeDelegationStruct)

  // 2. ABI-encode the inner execution
  const executionCalldata = encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }],
    [innerTarget, innerValue, innerCalldata],
  )

  // 3. Encode the redeemDelegations call
  return encodeFunctionData({
    abi: DELEGATOR_CORE_ABI,
    functionName: 'redeemDelegations',
    args: [
      [encodedDelegations],       // permissionContexts: bytes[][] (one chain per batch)
      [ModeCode.DEFAULT],          // modes: bytes32[]
      [executionCalldata],         // executionCallDatas: bytes[]
    ],
  })
}
```

### Delegation Struct Encoding
```ts
function encodeDelegationStruct(d: Delegation): Hex {
  return encodeAbiParameters(
    [
      { name: 'delegate', type: 'address' },
      { name: 'delegator', type: 'address' },
      { name: 'authority', type: 'bytes32' },
      { name: 'caveats', type: 'tuple[]', components: [
        { name: 'enforcer', type: 'address' },
        { name: 'terms', type: 'bytes' },
        { name: 'args', type: 'bytes' },
      ]},
      { name: 'salt', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    [d.delegate, d.delegator, d.authority === 'ROOT' ? '0x' + '0'.repeat(64) : d.authority,
     d.caveats.map(c => ({ enforcer: c.enforcer, terms: c.terms, args: '0x' })),
     d.salt, d.signature],
  )
}
```

---

## Section 14 — Chain Strategy

| Purpose | Chain | Chain ID |
|---------|-------|----------|
| Smart contracts | Ethereum Sepolia | 11155111 |
| ERC-7715 Flask | Ethereum Sepolia | 11155111 |
| 1Shot relay | Ethereum Sepolia | 11155111 |
| Venice x402 USDC payments | Base mainnet | 8453 |

### Deployed Contracts (Ethereum Sepolia)

| Contract | Address | Etherscan |
|----------|---------|-----------|
| OSKernel | `0xa4bD3e0946431dFA0C38F700f5935E03b749C77C` | [view](https://sepolia.etherscan.io/address/0xa4bD3e0946431dFA0C38F700f5935E03b749C77C) |
| AgentTreasury | `0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429` | [view](https://sepolia.etherscan.io/address/0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429) |
| ForgeOSRegistry | `0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68` | [view](https://sepolia.etherscan.io/address/0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68) |
| USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | |

### Deployed Contracts (Base Sepolia — alternate)

| Contract | Address |
|----------|---------|
| ForgeOSRegistry | `0x56D0D2bBc289CC51BDA49F38d05e8F7f9EBf2804` |
| OSKernel | `0x110502e906671e7715016472407a1981309501A8` |
| AgentTreasury | `0xd764DB26b34305eAc115c8051c6Bc9AeA947aa42` |

### Token Addresses

| Token | Chain | Address |
|-------|-------|---------|
| USDC | Ethereum Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| USDC | Base mainnet | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

### Critical Constraints
- ERC-7715 (`wallet_requestExecutionPermissions`) = Sepolia ONLY (MetaMask Flask limitation)
- Venice x402 payments = Base mainnet ONLY (Coinbase protocol limitation)
- Never use `ERC20.approve()` or `permit()` — delegation-only payment model throughout

---

## Section 15 — API Route Reference

### Activation Routes

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/relay/deploy` | `{ chainId?, userAddress? }` | `{ taskId, kernelAddress }` |
| POST | `/api/relay/delegate` | `{ delegation, chainId? }` | `{ taskId, delegationHash }` |
| POST | `/api/relay/fund` | `{ amountUsdc, treasuryAddress?, chainId? }` | `{ taskId, status }` |
| POST | `/api/relay/revoke` | `{ delegationHash, chainId? }` | `{ taskId, success }` |
| POST | `/api/relay/revoke-all` | `{}` | `{ taskId, success }` |

### Execution Routes

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/command` | `{ intent, systemContext }` | `{ actionPlan, streamUrl, veniceModel, cost }` |
| POST | `/api/execute` | `{ actionPlan, signedDelegations?, userAddress?, chainId? }` | `{ taskId, userOpHashes, estimatedConfirmation }` |
| POST | `/api/a2a/execute` | `{ intent, rootDelegationHash, subDelegationHash, reDelegationHash, signedDelegations?, userAddress? }` | `{ taskId, plan, primaryAgent, secondaryAgent, isA2A, hops }` |

### Subscription Routes

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/subscriptions/create` | `{ name, description, recipient, amount, frequencySeconds, maxPayments }` | `{ subscriptionId, delegation, taskId }` |
| POST | `/api/subscriptions/execute` | `{ subscriptionId }` | `{ taskId, txHash? }` |

### Agent Runtime Routes

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/agents/run` | `{ agentId, intent, rootDelegationHash, subDelegationHash, reDelegationHash }` | `{ taskId }` |
| GET | `/api/cron/agent-runner` | header: `Authorization: Bearer ${CRON_SECRET}` | `{ triggered: number }` |

### Registry Routes (Marketplace)

| Method | Path | Request | Response |
|--------|------|---------|----------|
| POST | `/api/registry/publish` | `{ name, description, category, promptTemplate, caveatTemplate, agentAddress }` | `{ agentId, ipfsUri, taskId }` |
| GET | `/api/registry/agents` | — | `{ agents: Agent[] }` |
| POST | `/api/registry/install` | `{ agentId, userAddress, parentDelegationHash }` | `{ delegationHash, erc7715Params }` |

### System Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/webhooks/1shot` | 1Shot webhook receiver (Ed25519 verified) |
| GET | `/api/events` | SSE stream (activity feed) |

---

## Section 16 — Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ONESHOT_API_KEY` | Yes | 1Shot relayer API key | `1shot_xxxxx` |
| `ONESHOT_RELAYER_URL` | No | 1Shot relayer endpoint (Sepolia: `.dev`; mainnet: `.com`) | `https://relayer.1shotapi.dev/relayers` |
| `ONESHOT_CHAIN_ID` | No | Target chain (default: 11155111) | `11155111` |
| `ONESHOT_WEBHOOK_URL` | No | Override webhook destination | `https://your-domain.com/api/webhooks/1shot` |
| `ONESHOT_WEBHOOK_SECRET` | Yes | Ed25519 public key for webhook verification | `0x...` |
| `AGENT_WALLET_KEY` | Yes | Server wallet private key (Venice SIWE signing) | `0x...` |
| `VENICE_BASE_URL` | No | Venice API base URL | `https://api.venice.ai/api/v1` |
| `VENICE_CHAIN_ID` | No | Chain for x402 payments (default: 8453) | `8453` |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (fallback: VERCEL_URL) | `https://forgeos.app` |
| `NEXT_PUBLIC_DEMO_MODE` | No | Enable demo mode with mock data | `false` |
| `FORGE_CHAIN_ID` | No | Primary chain override (default: 11155111) | `11155111` |
| `NEXT_PUBLIC_DEFI_AGENT_ADDRESS` | Yes (Phase 2) | DeFiAgent contract address | `0x...` |
| `NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS` | Yes (Phase 2) | PaymentAgent contract address | `0x...` |
| `CRON_SECRET` | Yes (Phase 4) | Secret for cron endpoint protection | `random-hex-64` |
| `PINATA_JWT` | No (Phase 6) | Pinata IPFS JWT for metadata pinning | `eyJ...` |
| `NEXT_PUBLIC_GRAPH_URL` | No | The Graph subgraph URL | `https://api.thegraph.com/subgraphs/...` |
| `RPC_URL` | No | Ethereum Sepolia RPC URL | `https://eth-sepolia.g.alchemy.com/v2/...` |

---

## Section 17 — Agent Template Schema

```ts
export type ConfigFieldType = 'text' | 'number' | 'address' | 'select' | 'toggle' | 'addressList'

export interface ConfigField {
  label: string
  type: ConfigFieldType
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: string[]           // for type='select'
  description?: string
  required?: boolean
}

export interface CaveatTemplate {
  enforcerName: string
  enforcer: Address
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

// Example — DeFi Rebalancer
export const DEFI_REBALANCER_TEMPLATE: AgentTemplate = {
  id: 'defi-rebalancer',
  name: 'DeFi Rebalancer',
  description: 'Automatically rebalances your portfolio to target allocations',
  category: 'defi',
  defaultPrompt: 'Rebalance the portfolio to maintain target allocations. Sell overweight assets, buy underweight. Max slippage 1%.',
  defaultCaveats: [
    {
      enforcerName: 'ERC20TransferAmountEnforcer',
      enforcer: '0x...',
      description: 'Max USDC per call',
      defaultTerms: { maxAmount: '500000000' },  // 500 USDC
    },
    {
      enforcerName: 'AllowedMethodsEnforcer',
      enforcer: '0x...',
      description: 'Only swap/rebalance methods',
      defaultTerms: { selectors: ['0x12345678', '0x87654321'] },
    },
  ],
  defaultIntervalSeconds: 3600,  // every hour
  configSchema: {
    targetBtcPct: { label: 'BTC Target %', type: 'number', defaultValue: 50, required: true },
    targetEthPct: { label: 'ETH Target %', type: 'number', defaultValue: 30, required: true },
    rebalanceThreshold: { label: 'Drift Threshold %', type: 'number', defaultValue: 5 },
    maxSlippage: { label: 'Max Slippage %', type: 'number', defaultValue: 1 },
  },
}
```

---

## Section 18 — IPFS Metadata Schema

Metadata pinned to IPFS when publishing an agent to the ForgeOSRegistry.

```json
{
  "name": "string",
  "description": "string",
  "category": "defi | nft | payments | social | custom",
  "version": "1.0.0",
  "promptTemplate": "string (Venice system prompt with {var} placeholders)",
  "caveatTemplate": {
    "enforcers": [
      {
        "name": "ERC20TransferAmountEnforcer",
        "address": "0x...",
        "defaultTerms": {}
      }
    ],
    "humanSummary": "This agent can transfer max $500 USDC per call"
  },
  "configSchema": {},
  "agentAddress": "0x...",
  "delegateAddress": "0x...",
  "defaultIntervalSeconds": 3600,
  "createdAt": 1234567890,
  "creator": "0x..."
}
```

**URI Format:** `ipfs://Qm...` stored in `ForgeOSRegistry.registerAgent(name, ipfsUri)`

**Fallback (no Pinata):** Encode as `data:application/json;base64,${btoa(JSON.stringify(metadata))}` and store inline if IPFS unavailable. Not recommended for production.

---

## Testing Strategy

| Layer | Framework | Coverage Target |
|-------|-----------|----------------|
| Unit (hooks, utils) | Vitest | 80% |
| API routes | Vitest + node | 70% |
| E2E (activation flow) | Playwright | Critical paths |
| Smart contracts | Foundry (fuzz + unit) | 100% |

**Critical paths for E2E:**
1. Full activation wizard (Steps 1-4) on Sepolia fork
2. A2A execute → webhook confirm → SSE delivery
3. Kill switch → all delegations revoked atomically

**Contract fuzz tests (Foundry):**
- `AgentTreasury`: fuzz `fund(amount)` with arbitrary amounts, verify 80/15/5 split invariant
- `OSKernel`: fuzz delegation creation + `revokeAll()`, verify no delegations survive
- `ForgeOSRegistry`: fuzz `registerAgent` + `deactivateAgent`, verify event emission
