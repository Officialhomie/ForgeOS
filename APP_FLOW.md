# Application Flow Document (APP_FLOW)
**Product:** ForgeOS
**Version:** 1.1
**Date:** May 27, 2026
**Related:** [PRD.md](./PRD.md) | [TRD.md](./TRD.md) | [UI_SPEC.md](./UI_SPEC.md) | [DATA_MODEL.md](./DATA_MODEL.md) | [IMPL.md](./IMPL.md)

---

## Screen Inventory

ForgeOS has 11 screens (8 existing + 3 new in Phase 5/6):

| # | Path | Name | Status |
|---|------|------|--------|
| 1 | `/` | Landing | Existing |
| 2 | `/activate` | Activation Wizard | Existing |
| 3 | `/dashboard` | Overview | Existing |
| 4 | `/dashboard/agents` | Agent Fleet | Existing |
| 5 | `/dashboard/agents/[id]` | Agent Detail | Existing |
| 6 | `/dashboard/delegations` | Delegation Tree | Existing |
| 7 | `/dashboard/subscriptions` | Subscriptions | Existing |
| 8 | `/dashboard/treasury` | Treasury | Existing |
| 9 | `/dashboard/builder` | No-Code Agent Builder | NEW (Phase 5) |
| 10 | `/marketplace` | Marketplace Browse | NEW (Phase 6) |
| 11 | `/marketplace/[agentId]` | Marketplace Detail + Install | NEW (Phase 6) |

---

## Navigation Map

```
/  ────────────────────────────────┐
│                                  │
├── [Activate] ──────────────────► /activate (4-step wizard)
│                                        │
│                                        ▼ (on complete)
└── [Open Dashboard] ─────────────► /dashboard
                                         │
                       ┌─────────────────┼─────────────────┐
                       │                 │                  │
                   /dashboard        /dashboard         /dashboard
                   /agents           /delegations       /treasury
                       │
                   /dashboard
                   /agents/[id]
                       │
              (from sidebar)
                       │
                   /dashboard
                   /subscriptions
                       │
                   /dashboard/builder  ──► /marketplace
                       │
                   /marketplace
                   /[agentId]  ──► (ERC-7715 install) ──► /dashboard
```

**Modal Overlays (accessible from any dashboard page):**
- **Command Bar** (`⌘K` or TopBar button) — triggers from any dashboard page
- **Kill Switch Modal** (TopBar red button) — always accessible
- **TopUp Modal** (Treasury page button) — opens inline on treasury page
- **Revoke Delegation Modal** (Delegation card overflow menu)

---

## User Journeys

### Journey 1 — First-Time Activation

**Entry:** User lands on `/`, clicks "Activate" or "Open Dashboard" (redirected to activate if not active).

**Flow:**
```
/ ──► /activate
       │
       ├── Step 1: Connect Wallet
       │     - Checks MetaMask Flask installed
       │     - Dual-extension conflict detection
       │     - wagmi.connect() → address shown in UI
       │     - [Next] enabled once connected
       │
       ├── Step 2: Deploy Smart Account
       │     - POST /api/relay/deploy
       │     - Loading state: "Deploying OSKernel..."
       │     - 1Shot webhook confirms → kernelAddress stored
       │     - [Next] auto-advances on Confirmed
       │
       ├── Step 3: Request Permissions
       │     - buildActivationPermissions(kernelAddress) called
       │     - MetaMask Flask approval UI shown
       │     - User approves → signed ERC-7710 delegation stored
       │     - Caveat preview shown: "Transfer max $500 USDC/month"
       │     - [Next] enabled after signature
       │
       └── Step 4: Fund Treasury
             - USDC amount input
             - POST /api/relay/fund
             - 1Shot confirms → treasury balance shown
             - [Complete Activation] → redirect to /dashboard
```

**State Changes:**
- `osStatus: 'inactive' → 'activating' → 'active'`
- `rootDelegation` stored in `delegations.store`
- `treasury.usdcBalance` set
- Activation state persisted to localStorage

**Error States:**
- No MetaMask Flask: "MetaMask Flask required"
- Dual extension: "Disable regular MetaMask, keep only Flask"
- Wrong network: `ForgeChainGuard` shows "Switch to Sepolia"
- Deploy failed: "Deploy failed — retry" with retry button

---

### Journey 2 — Run a Command (Natural Language)

**Entry:** User presses `⌘K` or clicks the command bar icon in TopBar.

**Flow:**
```
/dashboard (any page)
       │
       ▼ [⌘K opens CommandBarModal]
       │
       ├── CommandBarModal: "What should ForgeOS do?"
       │     - Text input: "Rebalance my portfolio to 50% BTC, 30% ETH, 20% USDC"
       │     - [Submit] → CommandState: idle → reasoning
       │
       ├── POST /api/command
       │     - Venice parses intent → ActionPlan returned
       │     - Plan shown: "Swap 150 USDC → BTC on Uniswap (Hop 1)"
       │                    "Swap 90 USDC → ETH on Uniswap (Hop 2)"
       │
       ├── [Confirm & Execute]
       │     - CommandState: reasoning → executing
       │     - Read delegation hashes from store
       │     - POST /api/a2a/execute (2-hop)
       │     - Receive taskId
       │
       ├── SSE stream fires when webhook confirms
       │     - CommandState: executing → confirmed
       │     - Display: "Transaction confirmed. TxHash: 0xABCD..."
       │
       └── [Close] → dismiss modal, activity feed updates
```

**State Changes:**
- `command.store.status` transitions through all states
- `activity.store` gets new confirmed event
- Agent `lastRunAt` / `runCount` updated

---

### Journey 3 — Build an Agent (No-Code Builder)

**Entry:** User navigates to `/dashboard/builder` via sidebar.

**Flow:**
```
/dashboard/builder
       │
       ├── Step 1: Pick Template
       │     - 5 template cards: DeFi, NFT, Payments, Social, Custom
       │     - Click → template loaded
       │
       ├── Step 2: Configure
       │     - Form rendered from AgentTemplate.configSchema
       │     - Venice prompt preview (editable textarea)
       │     - Spend cap input, interval selector
       │     - Real-time caveat JSON preview (CaveatPreview component)
       │     - Human-readable summary: "This agent can transfer max $X USDC per call to [contracts]"
       │     - [Deploy Agent] button
       │
       └── Step 3: Deploy
             - Creates sub-delegation with custom caveats via createSubDelegationStruct
             - POST /api/registry/publish → IPFS metadata + on-chain registration
             - Display: delegation hash + Sepolia Etherscan link
             - [View in Marketplace] link
             - [Back to Dashboard] link
```

**State Changes:**
- New agent added to `agents.store`
- `AgentRegistered` event emitted on Sepolia
- Agent appears in `/marketplace`

---

### Journey 4 — Install a Marketplace Agent

**Entry:** User browses `/marketplace`.

**Flow:**
```
/marketplace
       │
       ├── Filter: All | DeFi | NFT | Payments | Social
       │
       ├── Agent cards list (from ForgeOSRegistry on-chain events)
       │     - Click card → /marketplace/[agentId]
       │
       /marketplace/[agentId]
       │
       ├── Detail view:
       │     - Name, description, category, creator address
       │     - Caveat summary (what this agent can do)
       │     - Venice prompt preview
       │     - Creator earnings (on-chain)
       │     - [Install to My OS]
       │
       ├── [Install to My OS]
       │     - POST /api/registry/install → returns ERC-7715 params
       │     - requestExecutionPermissions(params) → MetaMask Flask approval UI
       │     - User approves → sub-delegation stored
       │     - Redirect → /dashboard/agents
       │
       └── Agent now appears in agent fleet
```

**State Changes:**
- New delegation in `delegations.store`
- Agent added to `agents.store`
- Marketplace shows "Installed" badge on agent card

---

### Journey 5 — Emergency Kill Switch

**Entry:** User clicks red "Kill Switch" button in TopBar (always visible).

**Flow:**
```
Any /dashboard/* page
       │
       ▼ [Kill Switch button in TopBar]
       │
       KillSwitchModal opens
       │
       ├── Warning message: "This will revoke ALL delegations immediately."
       │     - Shows count: "3 active delegations will be revoked"
       │     - [Cancel] | [Revoke Everything]
       │
       ├── [Revoke Everything]
       │     - Optimistic UI: all delegations → status: 'revoked' immediately
       │     - POST /api/relay/revoke-all
       │     - 1Shot submits OSKernel.revokeAll() via relay
       │
       ├── Webhook confirms
       │     - SSE event: os_revoked
       │     - Modal: "All delegations revoked. TxHash: 0x..."
       │     - Kill Switch button: greyed out, shows "Revoked"
       │
       └── On failure (webhook: Rejected)
             - Delegation snapshot restored
             - Error: "Kill switch failed: [reason]"
             - Kill Switch button: restored to active state
```

**State Changes:**
- All `delegations.status → 'revoked'`
- `osStatus → 'revoking' → 'inactive'`
- `useKillSwitch.isRevoked = true`

---

## Component Architecture

### Shared Layout Components

```
app/dashboard/layout.tsx
└── DashboardShell
      ├── Sidebar                    — nav links, OS status indicator
      ├── TopBar                     — network badge, ⌘K, Kill Switch, wallet
      └── {children}                 — page content

app/layout.tsx
└── WagmiProvider + QueryProvider + ZustandHydration
      └── ForgeChainGuard            — enforces Sepolia chain
            └── ActivationGuard      — enforces OS active
                  └── {children}
```

### Page-Specific Components

| Page | Components |
|------|-----------|
| `/` | none (inline JSX) |
| `/activate` | `ActivationWizard`, `ActivationProgress`, `StepOne_Connect`, `StepTwo_SmartAccount`, `StepThree_Delegate`, `StepFour_Confirm`, `WalletProviderNotice` |
| `/dashboard` | `AgentCard` (inline list), `StatusBadge`, `TokenAmount`, `LoadingSkeleton`, `EmptyState` |
| `/dashboard/agents` | `AgentCard`, `StatusBadge`, `EmptyState` |
| `/dashboard/agents/[id]` | `RunHistoryTable`, `ActionPlanVisualizer`, `StatusBadge` |
| `/dashboard/delegations` | `DelegationTree`, `DelegationCard`, `CaveatList`, `RevokeDelegationModal` |
| `/dashboard/treasury` | `TreasuryDonut`, `ActivityBarChart`, `RecentPaymentsTable`, `TopUpModal`, `TokenAmount` |
| `/dashboard/subscriptions` | `SubscriptionCard`, `StatusBadge` |
| `/dashboard/builder` | `TemplateCard`, `AgentConfigForm`, `CaveatPreview` — NEW |
| `/marketplace` | `MarketplaceAgentCard`, `CategoryFilter` — NEW |
| `/marketplace/[agentId]` | `AgentDetailHeader`, `CaveatSummary`, `InstallButton` — NEW |

### Overlay/Modal Components

| Component | Trigger | Location |
|-----------|---------|----------|
| `CommandBarModal` | TopBar ⌘K button | `components/CommandBarModal.tsx` |
| `KillSwitchModal` | TopBar Kill Switch button | `components/KillSwitchModal.tsx` |
| `TopUpModal` | Treasury page "Top Up" button | `components/treasury/TopUpModal.tsx` |
| `RevokeDelegationModal` | Delegation card overflow | `components/delegations/RevokeDelegationModal.tsx` |

### UI Primitive Components

| Component | Path | Purpose |
|-----------|------|---------|
| `Button` | `components/ui/Button.tsx` | Variants: default, secondary, ghost, destructive |
| `Card` | `components/ui/card.tsx` | Card + CardHeader + CardContent |
| `StatusBadge` | `components/ui/StatusBadge.tsx` | Active/running/paused/error states |
| `AddressDisplay` | `components/ui/AddressDisplay.tsx` | Truncated `0xABCD...1234` with copy |
| `TokenAmount` | `components/ui/TokenAmount.tsx` | USDC 6-decimal formatting |
| `LoadingSkeleton` | `components/ui/LoadingSkeleton.tsx` | Async loading placeholder |
| `EmptyState` | `components/ui/EmptyState.tsx` | Empty list with action slot |
| `CopyButton` | `components/ui/CopyButton.tsx` | Click-to-copy with feedback |
| `NetworkIndicator` | `components/ui/NetworkIndicator.tsx` | Chain name + indicator dot |
| `Progress` | `components/ui/progress.tsx` | Progress bar (radix-ui) |

---

## API Route Map

| Page | API Calls |
|------|-----------|
| `/activate` — Step 2 | `POST /api/relay/deploy` |
| `/activate` — Step 3 | client-side MetaMask `wallet_requestExecutionPermissions` |
| `/activate` — Step 4 | `POST /api/relay/fund` |
| `/dashboard` | reads from Zustand stores (populated by hooks) |
| `/dashboard/agents` | hooks: `useAgents` → `GET /api/registry/agents` (marketplace) |
| `/dashboard/agents/[id]` | hook: `useAgentRuns` |
| `/dashboard/delegations` | hook: `useDelegations` |
| `/dashboard/treasury` | hook: `useTreasury` → The Graph / `readTreasuryBalance()` |
| `/dashboard/subscriptions` | hook: `useSubscriptions` |
| CommandBarModal | `POST /api/command` → `POST /api/a2a/execute` or `POST /api/execute` |
| KillSwitchModal | `POST /api/relay/revoke-all` |
| TopUpModal | `POST /api/relay/fund` |
| RevokeDelegationModal | `POST /api/relay/revoke` |
| `/dashboard/builder` | `POST /api/registry/publish` |
| `/marketplace` | `GET /api/registry/agents` |
| `/marketplace/[agentId]` | `POST /api/registry/install` → MetaMask ERC-7715 |

---

## Integration Touchpoints

### MetaMask Flask
- **Where:** Step 1 (connect), Step 3 (ERC-7715), Marketplace Install
- **Method:** `wagmi.connect()` for connect, `walletClient.requestExecutionPermissions()` for ERC-7715
- **Files:** `StepOne_Connect.tsx`, `StepThree_Delegate.tsx`, `lib/activation/permissions.ts`, `hooks/useActivation.ts`

### Venice AI
- **Where:** CommandBar execution, A2A orchestration, agent runtime cron
- **Method:** `VeniceClient.chat()` for planning, `VeniceClient.embeddings()` for multi-endpoint track
- **Files:** `lib/venice/client.ts`, `services/orchestrator/intent-parser.ts`, `app/api/command/route.ts`

### 1Shot Relay
- **Where:** All transaction submissions (deploy, fund, execute, revoke, revoke-all, fund)
- **Method:** `getCapabilities → getFeeData → send7710Transaction`
- **Files:** `lib/oneshot/client.ts`, all `/api/relay/*` routes, `/api/execute`, `/api/a2a/execute`

### SSE (Server-Sent Events)
- **Where:** Dashboard activity feed, CommandBar confirmation, Kill Switch confirmation
- **Method:** `GET /api/events` → `EventSource` in `useActivityStream`
- **Files:** `app/api/events/route.ts`, `hooks/useActivityStream.ts`, `lib/events/activity-emitter.ts`

### Webhook (1Shot → ForgeOS)
- **Where:** All transaction confirmation flows
- **Method:** `POST /api/webhooks/1shot` with Ed25519 signature
- **Files:** `app/api/webhooks/1shot/route.ts`

### The Graph (Subgraph)
- **Where:** Treasury page, delegations page
- **Method:** GraphQL queries via `lib/graph/client.ts`
- **Files:** `lib/graph/client.ts`, `lib/graph/queries.ts`, `lib/graph/mappers.ts`
- **Note:** Graceful fallback to RPC reads if `NEXT_PUBLIC_GRAPH_URL` not configured

---

## Data Flow Diagram

```
User Action
     │
     ▼
React Component (page/modal)
     │ calls hook
     ▼
Custom Hook (useActivation, useCommandBar, useTreasury...)
     │ calls API route
     ▼
Next.js API Route (/api/*)
     │
     ├── Venice AI (inference/planning)
     │
     ├── 1Shot Relay (gas-free tx submission)
     │        │
     │        └── On-Chain (Sepolia) ← redeemDelegations() ← OSKernel caveats enforced
     │
     └── Returns { taskId }
           │
           ▼
1Shot Webhook → /api/webhooks/1shot (Ed25519 verified)
     │
     ├── taskStore.update(taskId, status)
     └── activityEmitter.emitActivity(event)
           │
           ▼
SSE Stream (/api/events) → EventSource in client
     │
     ▼
useActivityStream → activityStore.addActivity(event)
     │
     ▼
UI re-renders with confirmed state
```

---

## Guards and Middleware

### `ForgeChainGuard` (`components/ForgeChainGuard.tsx`)
- Wraps all dashboard pages
- Detects current wagmi chain
- If not Sepolia (11155111): shows "Switch to Sepolia" overlay
- Prevents all actions on wrong chain

### `ActivationGuard` (`components/guards/ActivationGuard.tsx`)
- Wraps all `/dashboard/*` pages
- Reads `osStatus` from `os.store`
- If `osStatus !== 'active'`: redirects to `/activate`
- Exception: allows through if demo mode enabled

### `WalletProviderNotice` (`components/activation/WalletProviderNotice.tsx`)
- Shown in Step 1 of activation
- Detects if MetaMask Flask is NOT installed
- Shows install link and instructions

---

## Routing Architecture

```
/app
├── layout.tsx                — root layout (WagmiProvider, QueryProvider, ZustandHydrate)
├── page.tsx                  — landing page
├── activate/
│   └── page.tsx              — activation wizard
└── dashboard/
    ├── layout.tsx            — dashboard shell (DashboardShell, ActivationGuard)
    ├── page.tsx              — overview
    ├── agents/
    │   ├── page.tsx          — fleet list
    │   └── [id]/
    │       └── page.tsx      — agent detail
    ├── delegations/
    │   └── page.tsx          — delegation tree
    ├── treasury/
    │   └── page.tsx          — treasury + charts
    ├── subscriptions/
    │   └── page.tsx          — subscription list
    └── builder/
        └── page.tsx          — no-code builder (NEW)

/marketplace/
├── page.tsx                  — browse agents (NEW)
└── [agentId]/
    └── page.tsx              — agent detail + install (NEW)
```

---

## State Persistence

| Store | Persistence | When Reset |
|-------|-------------|-----------|
| `os.store` | localStorage (via `lib/activation/storage.ts`) | Manual reset or `revokeAll` |
| `delegations.store` | localStorage | `revokeAll` clears all |
| `agents.store` | In-memory (re-fetched on load) | Page refresh |
| `treasury.store` | In-memory + re-fetched | Page refresh |
| `activity.store` | In-memory (last 50 events) | Page refresh |
| `command.store` | In-memory | Closes on unmount |
