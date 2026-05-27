# Implementation Plan — Living Document
**Product:** ForgeOS
**Version:** 1.1
**Date:** May 27, 2026
**Deadline:** June 15, 2026

---

## IF YOU ARE AN AGENT PICKING THIS UP

**Read this first — do not skip.**

1. Read [PRD.md](./PRD.md) for product vision and prize tracks.
2. Read [TRD.md](./TRD.md) for all 12 operational flows and the ERC-4337 UserOp construction spec (Section 13).
3. Read [APP_FLOW.md](./APP_FLOW.md) for the screen inventory, navigation map, and API route map.
4. Read [DATA_MODEL.md](./DATA_MODEL.md) for all TypeScript types and Zustand store shapes.
5. Read [CHAINS.md](./CHAINS.md) for deployed contract addresses.
6. Check the **Flow Matrix** below to see OFD flow status and which implementation phase owns each flow.
7. Work phases **0 → 10** in order; never skip Phase 1–2 before claiming Flow 7 complete.

**Do NOT redeploy** Solidity in `contracts/` unless explicitly told.

---

## Flow Matrix (OFD v1.0 — source of truth)

| Flow | Name | Priority | Impl Phase | Status | Key files |
|------|------|----------|--------------|--------|-----------|
| 1 | Onboarding / Smart Account | Light | 5 | Partial | `useActivation.ts`, `activate/*` |
| 2 | No-Code Builder | Medium | 6 | Partial | `dashboard/builder`, `useAgentBuilder.ts` |
| 3 | Test & Delegation Approval | Critical | 6 | In progress | `useAgentBuilder.ts`, `buildPermissions.ts` |
| 4 | Publish to Marketplace | Medium | 7 | Mostly done | `api/registry/publish` |
| 5 | Discovery & Install | Light | 7 | In progress | `useMarketplace.ts`, `api/registry/install` |
| 6 | Master OS Activation | Critical | 1–2 | In progress | `useActivation.ts`, `relay/redelegate` |
| 7 | Sub-Agent Runtime Execution | Critical | 3 | In progress | `useAgentExecute.ts`, `agents/run`, cron |
| 8 | Sub-Agent Collaboration | Medium | 9 | Stub | `orchestrator/index.ts` |
| 9 | x402 & Treasury | Medium | 8 | Partial | `venice/client.ts`, `treasury/guard.ts` |
| 10 | Dashboard Monitoring | Light | 8 | Partial | `useDelegations.ts`, `dashboard/status` |
| 11 | Revocation / Kill Switch | Critical | 4 | Partial | `useKillSwitch.ts`, `relay/revoke-all` |
| 12 | Error Handling & Telemetry | Cross-cutting | 4, 8 | In progress | `flow-timer.ts`, API routes |
| 13 | Pre-flight / readiness | Ops | 10 | In progress | `api/health`, `dashboard/status` |
| 14 | Delegation health audit | Ops | 10 | In progress | `api/delegations/audit` |
| 15 | Proof bundle export | Ops | 10 | In progress | delegations page |
| 16 | Install → run bridge | Ops | 7 | In progress | cron + agents store |
| 17 | Treasury circuit breaker | Ops | 8 | In progress | `treasury/guard.ts` |
| 18 | Expiry renewal prompt | Ops | 10 | In progress | dashboard banner |
| 19 | Demo vs live mode | Ops | 10 | In progress | `lib/demo.ts` |

## Implementation Phases (0–10)

| Phase | Name | Status | Blocks |
|-------|------|--------|--------|
| 0 | Flow tracker & docs | DONE | — |
| 1 | Delegation proof foundation | In progress | Flows 6, 7, 11 |
| 2 | On-chain sub-delegation chain | In progress | Flow 6, A2A |
| 3 | Runtime execution hardening | In progress | Flow 7, 12 |
| 4 | Revocation & error recovery | In progress | Flows 11, 12 |
| 5 | Onboarding polish | In progress | Flow 1 |
| 6 | Builder test/approve/draft | In progress | Flows 2, 3 |
| 7 | Marketplace full loop | In progress | Flows 4, 5, 16 |
| 8 | Treasury & dashboard data | In progress | Flows 9, 10, 17 |
| 9 | Collaboration | In progress | Flow 8 |
| 10 | Ops flows 13–19 | In progress | — |

**Execution order:** 0 → 1 → 2 → 3 → 4; then 5–10 as in plan. Never skip 1–2 for Flow 7.

---

## Phase 0 — Project Documents

**Status: DONE**

**Files created:**
- `/Users/mac/ForgeOS/PRD.md`
- `/Users/mac/ForgeOS/TRD.md`
- `/Users/mac/ForgeOS/APP_FLOW.md`
- `/Users/mac/ForgeOS/UI_SPEC.md`
- `/Users/mac/ForgeOS/DATA_MODEL.md`
- `/Users/mac/ForgeOS/IMPL.md` (this file)
- `README.md` updated (see Phase 0 completion)

---

## Phase 1 — Fix: ERC-4337 UserOp Encoding

> **Status:** Superseded by Flow-Tracked Phases 0–10 (May 2026). Encoding lives in `encode-redeem.ts` + strict proof validation in Phase 1 of flow plan.

**Status: TODO (legacy section)**
**Track evidence:** Best 1Shot, Best A2A, Best x402+ERC-7710

### Goal
`userop-builder.ts` currently sets `callData = action.calldata` which is the inner contract call. For the MetaMask Delegation Framework to work, `callData` must be `DeleGatorCore.redeemDelegations(permissionContexts, modes, executionCallDatas)` encoding. Without this, 1Shot receives valid-looking UserOps but the on-chain entrypoint cannot enforce caveats.

### Reference
See TRD.md Section 13 for complete encoding spec, ABI fragment, and ModeCode values.

### Files to create

**`app/src/lib/delegation/encode-redeem.ts`** (NEW)
```ts
// Exports:
export function encodeRedeemDelegations(
  delegations: Delegation[],
  innerTarget: Address,
  innerCalldata: Hex,
  innerValue: bigint,
): Hex

// Pure function. No side effects. Uses viem encodeFunctionData + encodeAbiParameters.
// delegations = ordered chain: [root, sub, re] (most permissive first)
// Calls DELEGATOR_CORE_ABI.redeemDelegations([encoded chain], [ModeCode.DEFAULT], [innerExec])
```

### Files to modify

**`app/src/services/execution-engine/userop-builder.ts`**
- Import `encodeRedeemDelegations` from `@/lib/delegation/encode-redeem`
- In `buildUserOps`, replace `callData: action.calldata` with:
  ```ts
  callData: encodeRedeemDelegations(
    proofs,                    // the matched delegation objects
    action.target,
    action.calldata,
    action.value,
  )
  ```
- Remove the TODO comment at line 61

**`app/src/app/api/execute/route.ts`**
- Change the UserOp builder block (lines 64-76) to use `buildUserOps` from `userop-builder` instead of inline `.map()`
- Import and call `buildUserOps({ actions, signedDelegations, senderAddress: body.userAddress })`
- Remove the comment "In production these would be fully constructed ERC-4337 UserOps"

**`app/src/app/api/a2a/execute/route.ts`**
- No changes needed — it already calls `buildUserOps()` correctly (line 121)
- The fix in `userop-builder.ts` automatically propagates here

**`app/src/types/index.ts`**
- Add `ModeCode` type alias and `MODE_DEFAULT` constant

### Definition of Done
- `POST /api/execute` with a mock ActionPlan returns UserOps where `callData` starts with `0x80c3cd97` (redeemDelegations selector) or the correct keccak256 4-byte selector
- TypeScript compiles with no errors
- `validateUserOps` passes for a 2-hop plan

### Pickup Instructions
1. Read `app/src/services/execution-engine/userop-builder.ts` fully
2. Read TRD.md Section 13 (ERC-4337 UserOp Construction Spec) for the exact encoding
3. Create `encode-redeem.ts` first, then modify `userop-builder.ts`, then modify `execute/route.ts`
4. Run `cd app && pnpm tsc --noEmit` after each file to catch type errors

---

## Phase 2 — Fix: Auto Sub-Delegation Creation

**Status: TODO**
**Track evidence:** Best A2A Coordination (cannot work without this)

### Goal
`/api/a2a/execute` requires 3 delegation hashes: `rootDelegationHash`, `subDelegationHash`, `reDelegationHash`. After OS activation, only `rootDelegation` exists. Sub-delegations (OSKernel → DeFiAgent → PaymentAgent) are never created.

This phase auto-creates the 2-hop sub-delegation chain on dashboard load and stores the results in `delegations.store`.

### Files to create

**`app/src/lib/delegation/auto-delegate.ts`** (NEW)
```ts
// Exports:
export function createOSSubDelegations(
  rootDelegation: Delegation,
  defiAgentAddress: Address,
  paymentAgentAddress: Address,
): {
  subDelegation: Delegation
  subHash: Hash
  reDelegation: Delegation
  reHash: Hash
}
// Uses createSubDelegationStruct + createReDelegationStruct from existing lib
// Returns fully formed delegation structs (no wallet signature needed — created by OSKernel)
```

**`app/src/hooks/useSubDelegations.ts`** (NEW)
```ts
// Exports:
export function useSubDelegations(): {
  subDelegationHash: Hash | null
  reDelegationHash: Hash | null
  ready: boolean
}
// On mount: reads rootDelegation from os.store
// If rootDelegation exists but subDelegation does not: calls createOSSubDelegations
// Stores results via delegations.store.setSubDelegation + setReDelegation
// Returns hashes for use in command bar
```

### Files to modify

**`app/src/stores/delegations.store.ts`**
- Add `subDelegation: Delegation | null` field (default `null`)
- Add `reDelegation: Delegation | null` field (default `null`)
- Add `setSubDelegation(d: Delegation | null): void` action
- Add `setReDelegation(d: Delegation | null): void` action

**`app/src/app/dashboard/layout.tsx`**
- Import and mount `useSubDelegations` hook
- Runs automatically when dashboard loads after activation

### Required Environment Variables
```env
NEXT_PUBLIC_DEFI_AGENT_ADDRESS=0x...    # DeFiAgent smart contract address
NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS=0x...  # PaymentAgent smart contract address
```

These can be any Sepolia addresses for hackathon purposes. Use the deployer address if agent contracts are not separately deployed.

### Definition of Done
- Load `/dashboard` after activation
- `delegations.store.subDelegation` is non-null
- `delegations.store.reDelegation` is non-null
- `subDelegation.authority` = `rootDelegation.hash`
- `reDelegation.authority` = `subDelegation.hash`
- TypeScript compiles cleanly

### Pickup Instructions
1. Read `app/src/lib/delegation/createSubDelegation.ts` to understand existing struct builders
2. Read `app/src/stores/delegations.store.ts` before modifying
3. Create `auto-delegate.ts` first (pure function, easy to test)
4. Then create `useSubDelegations.ts`
5. Then update the store
6. Finally, mount the hook in `dashboard/layout.tsx`

---

## Phase 3 — Fix: Command → Execute Full Pipeline

**Status: TODO**
**Track evidence:** Best Agent, Best A2A, Best Venice AI

### Goal
`POST /api/command` returns an `ActionPlan`. The client has no code that takes that plan, injects delegation hashes, and submits to `/api/a2a/execute`. The command bar is a dead-end today.

### Files to create

**`app/src/hooks/useAgentExecute.ts`** (NEW)
```ts
// Exports:
export function useAgentExecute(): {
  executeIntent: (intent: string, context?: VeniceSystemContext) => Promise<{taskId: string; plan: ActionPlan}>
  isExecuting: boolean
  error: string | null
}
// Encapsulates: command → plan → inject delegation hashes → execute → return taskId
// Reusable by CommandBar AND agent runtime trigger
```

### Files to modify

**`app/src/hooks/useCommandBar.ts`** (or equivalent command hook)
- After receiving `actionPlan` from `/api/command`:
  - Read `rootDelegation.hash` from `os.store`
  - Read `subDelegation.hash` from `delegations.store`
  - Read `reDelegation.hash` from `delegations.store`
  - If plan has 2 hops (A2A): POST to `/api/a2a/execute` with all 3 hashes + full delegation objects
  - If plan has 1 hop: POST to `/api/execute` with signedDelegations
  - Set `CommandState.status → 'executing'`
  - Receive `{ taskId }` → store in `command.store`
  - Watch SSE stream for task confirmation

**`app/src/components/CommandBarModal.tsx`**
- Show full execution lifecycle:
  - `idle`: text input + recent commands
  - `reasoning`: spinner + "Thinking..."
  - `planning`: plan preview with action list
  - `executing`: progress indicator + "Submitting to 1Shot..."
  - `confirmed`: green check + txHash display + [Close] button
  - `failed`: red X + error message + [Retry] button
- "Confirm & Execute" button between planning and executing states (optional — can auto-execute)

### Definition of Done
- Type intent "Rebalance my portfolio" in command bar
- Status transitions through all phases
- SSE fires and modal shows `confirmed` state with txHash
- TypeScript compiles cleanly

### Pickup Instructions
1. Read `app/src/stores/command.store.ts` first
2. Read `app/src/hooks/useCommandBar.ts` (or `useAgents.ts` — find where command logic lives)
3. Read `app/src/app/api/command/route.ts` to understand the response shape
4. Create `useAgentExecute.ts` first
5. Then modify `useCommandBar.ts`
6. Then update `CommandBarModal.tsx`

---

## Phase 4 — Fix: Agent Runtime Cron Trigger

**Status: TODO**
**Track evidence:** Best Agent ("runs while you sleep"), Best 1Shot

### Goal
Agents never execute autonomously. This phase adds:
1. `lib/agents/templates.ts` — 5 built-in agent templates with default configs
2. `/api/agents/run` — single-agent execution endpoint
3. `/api/cron/agent-runner` — Vercel Cron endpoint (every 5 min)
4. `vercel.json` — cron schedule config

### Files to create

**`app/src/lib/agents/templates.ts`** (NEW)
```ts
export const AGENT_TEMPLATES: AgentTemplate[] = [
  { id: 'defi-rebalancer', name: 'DeFi Rebalancer', ... },
  { id: 'payment-executor', name: 'Payment Executor', ... },
  { id: 'nft-lifeguard', name: 'NFT Lifeguard', ... },
  { id: 'social-poster', name: 'Social Poster', ... },
  { id: 'data-broker', name: 'Data Broker', ... },
]
// AgentTemplate interface defined in DATA_MODEL.md → Section "Builder / Marketplace"
```

**`app/src/app/api/agents/run/route.ts`** (NEW)
```ts
// POST /api/agents/run
// Body: { agentId, intent, rootDelegationHash, subDelegationHash, reDelegationHash }
// 1. Calls orchestrate() → Venice ActionPlan
// 2. buildUserOps() → encodes redeemDelegations calldata (Phase 1)
// 3. send7710Transaction() → 1Shot relay
// 4. Returns { taskId }
```

**`app/src/app/api/cron/agent-runner/route.ts`** (NEW)
```ts
// GET /api/cron/agent-runner
// Authorization: Bearer ${CRON_SECRET}
// Reads agent configs, fires POST /api/agents/run for each enabled agent
// Responds 200 immediately (fire-and-forget)
```

**`app/vercel.json`** (NEW)
```json
{
  "crons": [
    {
      "path": "/api/cron/agent-runner",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Files to modify

**`app/src/types/index.ts`**
- Add `AgentRuntimeConfig` interface (see DATA_MODEL.md)

**`app/src/stores/agents.store.ts`**
- Add `agentConfigs: Record<AgentId, AgentRuntimeConfig>` field
- Add `setAgentConfig(id, config)` action

### Required Environment Variables
```env
CRON_SECRET=random-hex-64    # Vercel passes this as Bearer token to cron endpoint
```

### Definition of Done
- `GET /api/cron/agent-runner` (with correct bearer token) fires and returns `{ triggered: N }`
- Each enabled agent calls `POST /api/agents/run` and gets `{ taskId }`
- TypeScript compiles cleanly

### Pickup Instructions
1. Read `app/src/services/orchestrator/index.ts` to understand `orchestrate()`
2. Read `app/src/lib/oneshot/client.ts` for `send7710Transaction` signature
3. Create `templates.ts` first (no deps, just data)
4. Create `agents/run/route.ts` second
5. Create `cron/agent-runner/route.ts` third
6. Create `vercel.json` last (deploy config)

---

## Phase 5 — Build: No-Code Agent Builder UI

**Status: TODO**
**Track evidence:** Best Agent (user-configurable agents), key for Marketplace

### Goal
Form-based 3-step builder: pick template → configure → deploy. Produces a sub-delegation with custom caveats + on-chain registry entry.

### Files to create

**`app/src/app/dashboard/builder/page.tsx`** (NEW)
```tsx
// Step 1: Template picker (5 TemplateCard components)
// Step 2: Configure (AgentConfigForm + CaveatPreview)
// Step 3: Deploy (tx confirmation + delegation hash display)
// Step state managed by useAgentBuilder hook
```

**`app/src/components/builder/TemplateCard.tsx`** (NEW)
- Visual card: category badge, name, description, "Use template" button
- Props: `template: AgentTemplate`, `onSelect: () => void`

**`app/src/components/builder/AgentConfigForm.tsx`** (NEW)
- Dynamic form from `AgentTemplate.configSchema`
- Venice prompt textarea (editable, pre-filled from `defaultPrompt`)
- Spend cap input, interval selector
- On change: updates `CaveatPreview` in real-time

**`app/src/components/builder/CaveatPreview.tsx`** (NEW)
- Read-only: generated ERC-7710 caveat JSON
- Human-readable summary line: "This agent can transfer max $X USDC per call"

**`app/src/hooks/useAgentBuilder.ts`** (NEW)
```ts
// State machine: idle → configuring → deploying → deployed
// buildAgent(template, config): creates sub-delegation → POST /api/registry/publish → returns { agentId, delegationHash, txHash }
```

### Files to modify

**`app/src/components/layout/Sidebar.tsx`**
- Add `{ href: '/dashboard/builder', label: 'Builder', icon: 'Hammer' }` to `NAV_ITEMS` in `lib/constants.ts`
- Add `Hammer` import from `lucide-react`
- Add `Hammer` to `ICONS` map

**`app/src/lib/constants.ts`**
- Add `{ href: '/dashboard/builder', label: 'Builder', icon: 'Hammer' }` to `NAV_ITEMS`
- Add `{ href: '/marketplace', label: 'Marketplace', icon: 'Store' }` to `NAV_ITEMS`

### Definition of Done
- Navigate to `/dashboard/builder` via sidebar
- Complete all 3 steps without errors
- Step 3 shows delegation hash and Sepolia Etherscan link
- TypeScript compiles cleanly

---

## Phase 6 — Build: Marketplace

**Status: TODO**
**Track evidence:** "App Store" product vision, marketable demo

### Goal
Publish, browse, and install agents from `ForgeOSRegistry.sol`. Full loop: Builder → Registry → Marketplace → Install via ERC-7715.

### Files to create

**`app/src/app/marketplace/page.tsx`** (NEW)
- `GET /api/registry/agents` → renders MarketplaceAgentCard grid
- Filter by category
- "Install" links to `[agentId]` page

**`app/src/app/marketplace/[agentId]/page.tsx`** (NEW)
- Agent detail: description, caveats, creator, stats
- "Install to My OS" → `/api/registry/install` → MetaMask ERC-7715

**`app/src/app/api/registry/publish/route.ts`** (NEW)
- Uploads metadata to IPFS via Pinata (or inline base64 fallback)
- Calls `ForgeOSRegistry.registerAgent(name, ipfsUri)` via 1Shot
- Returns `{ agentId, ipfsUri, taskId }`

**`app/src/app/api/registry/agents/route.ts`** (NEW)
- Queries `AgentRegistered` events via `eth_getLogs` on Sepolia
- Returns `MarketplaceAgent[]` list

**`app/src/app/api/registry/install/route.ts`** (NEW)
- Creates sub-delegation for marketplace agent using stored caveatTemplate
- Returns ERC-7715 permission params for client to trigger MetaMask

**`app/src/lib/ipfs/client.ts`** (NEW)
```ts
export async function pinJson(metadata: object): Promise<string>
// Returns ipfs://Qm... URI
// Uses Pinata API if PINATA_JWT env is set
// Falls back to data:application/json;base64,... if not
```

**`app/src/hooks/useMarketplace.ts`** (NEW)
```ts
// Fetches agents from GET /api/registry/agents
// installAgent(agentId): calls /api/registry/install → triggers ERC-7715 in MetaMask
```

### Files to modify

**`app/src/components/layout/Sidebar.tsx`** + `lib/constants.ts`
- Marketplace nav item (same as Phase 5 sidebar change — do once)

### Required Environment Variables
```env
PINATA_JWT=eyJ...          # Optional: if not set, uses base64 inline fallback
```

### Definition of Done
- Navigate to `/marketplace`
- Agents list loads (at least 1 agent published via Builder)
- "Install" button triggers MetaMask Flask ERC-7715 approval dialog
- After approval, agent appears in `/dashboard/agents`

---

## Phase 7 — Fix: Treasury Top-Up Wiring

**Status: TODO**
**Track evidence:** Best x402+ERC-7710 (treasury self-management)

### Goal
`TopUpModal.tsx` has a number input and button but no handler. Wire it to `POST /api/relay/fund` with proper ABI-encoded calldata.

### Files to modify

**`app/src/app/api/relay/fund/route.ts`**
- Replace the stub UserOp `{ treasury: ..., amount: ... }` object with proper ABI-encoded calldata:
  ```ts
  import { encodeFunctionData } from 'viem'
  const AGENT_TREASURY_ABI = [{ name: 'fund', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }] }] as const
  const callData = encodeFunctionData({ abi: AGENT_TREASURY_ABI, functionName: 'fund', args: [BigInt(body.amountUsdc ?? '0')] })
  ```
- Pass `callData`, `target: CONTRACTS.agentTreasury` to `send7710Transaction`

**`app/src/components/treasury/TopUpModal.tsx`**
- Read current file first
- Add `onFund(amountUsdc: string)` handler that calls `POST /api/relay/fund`
- Show pending state (spinner, "Submitting...")
- Show `taskId` confirmation with Etherscan link
- Close on success

**`app/src/hooks/useTreasury.ts`**
- Add `topUp(amountUsdc: string): Promise<{ taskId: string }>` method
- Calls `POST /api/relay/fund`
- On webhook confirm: refreshes `treasury.usdcBalance`

### Definition of Done
- Click "Top Up" in treasury panel
- Enter amount, submit
- `taskId` returned
- After webhook confirmation, treasury balance updates

---

## Risk Flags

| Risk | Mitigation |
|------|-----------|
| `redeemDelegations` selector mismatch between toolkit versions | Test with hardcoded test delegation first; check ABI against `contracts/src/interfaces/` |
| Sub-delegation scope narrowing enforcement | Test on Sepolia with known caveats before A2A demo |
| 1Shot rejects UserOp format | Use 1Shot API docs for exact `send7710Transaction` request shape |
| IPFS pinning quota | Inline base64 fallback always available |
| Vercel Cron not on free tier | `/api/cron/agent-runner` also works as manual `GET` trigger |
| MetaMask Flask ERC-7715 for marketplace | Reuse exact `requestExecutionPermissions` code from `useActivation` — identical flow |

---

## Verification Checklist

### Phase 1 (UserOp Encoding)
- [ ] `callData` in submitted UserOp contains `redeemDelegations` 4-byte selector
- [ ] `permissionContexts` contains ABI-encoded delegation structs
- [ ] `executionCallDatas` contains inner contract call
- [ ] `pnpm tsc --noEmit` passes

### Phase 2 (Sub-Delegations)
- [ ] `delegations.store.subDelegation` non-null after dashboard load
- [ ] `subDelegation.authority === rootDelegation.hash`
- [ ] `reDelegation.authority === subDelegation.hash`
- [ ] Caveats are correctly narrowed (sub: 500 USDC, re: 100 USDC)

### Phase 3 (Command Pipeline)
- [ ] Command bar input → status transitions correctly
- [ ] A2A intent → `POST /api/a2a/execute` with all 3 hashes
- [ ] SSE event arrives → modal shows `confirmed` with txHash
- [ ] Single intent → `POST /api/execute`

### Phase 4 (Cron)
- [ ] `GET /api/cron/agent-runner` with bearer token → 200
- [ ] Each enabled agent triggers `POST /api/agents/run`
- [ ] `vercel.json` cron schedule parses correctly

### Phase 5 (Builder)
- [ ] All 3 builder steps complete without errors
- [ ] Delegation hash shown after deploy
- [ ] `AgentRegistered` event visible on Sepolia Etherscan

### Phase 6 (Marketplace)
- [ ] `/marketplace` shows agents from `ForgeOSRegistry`
- [ ] "Install" triggers MetaMask ERC-7715 dialog
- [ ] Installed agent appears in `/dashboard/agents`

### Phase 7 (Treasury)
- [ ] TopUpModal submit calls `POST /api/relay/fund`
- [ ] Proper ABI calldata sent (not raw `{ treasury, amount }`)
- [ ] Balance updates after webhook confirm

---

## Key File Locations

| Purpose | File |
|---------|------|
| Delegation struct builders | `app/src/lib/delegation/createSubDelegation.ts` |
| Root delegation creation | `app/src/lib/delegation/createRootDelegation.ts` |
| Venice client (x402) | `app/src/lib/venice/client.ts` |
| 1Shot relay client | `app/src/lib/oneshot/client.ts` |
| Orchestrator (A2A intent) | `app/src/services/orchestrator/index.ts` |
| Intent parser | `app/src/services/orchestrator/intent-parser.ts` |
| UserOp builder | `app/src/services/execution-engine/userop-builder.ts` |
| Webhook handler | `app/src/app/api/webhooks/1shot/route.ts` |
| SSE stream | `app/src/app/api/events/route.ts` |
| Activation wizard | `app/src/hooks/useActivation.ts` |
| Contracts | `contracts/src/` |
| Contract addresses | `CHAINS.md` |
| TypeScript types | `app/src/types/index.ts` |
| Zustand stores | `app/src/stores/*.store.ts` |
| Constants | `app/src/lib/constants.ts` |

---

## Quick Start

```bash
cd app
pnpm install
cp .env.example .env.local
# Fill in ONESHOT_API_KEY, AGENT_WALLET_KEY, ONESHOT_WEBHOOK_SECRET
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). MetaMask Flask must be installed and on Sepolia.
