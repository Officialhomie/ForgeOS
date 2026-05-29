# ForgeOS Demo Playbook

27 testable workflows organized into 6 chapters that tell a coherent story.
Use this as a reference when recording demo videos or preparing for judging.

---

## Treasury Architecture Note

The `AgentTreasury` contract tracks **per-user balances** via `mapping(address => uint256) public userBalance`.
Each user's USDC is isolated — `fund()` credits your address, `withdraw()` returns it to you.
The `executePayment()` call debits the specific user whose agent is executing.

---

## Chapter 1: "First Contact" — Activation & Setup

> The story: Go from zero to fully operational in under 5 minutes.

### WF-01: OS Activation (The Full Onboarding)
**Route**: `/` → `/activate`
**Steps**:
1. Connect MetaMask — wallet detection, chain check
2. Deploy Smart Account — ERC-4337 counterfactual address shown before deployment
3. Grant root delegation — MetaMask signs ONE EIP-7715 permission that powers everything
4. Fund treasury — USDC deposit via 1Shot relay, balance appears immediately

**What to show**: Each step gates the next. The "one signature" moment at Step 3.
**Key message**: One approval gives agents permission to act. You can revoke at any time.
**Tech**: MetaMask Smart Accounts Kit, EIP-7715 delegation, `createRootDelegation`

---

### WF-02: The Kill Switch
**Route**: Top bar red button (visible on every page after activation)
**Steps**:
1. Show red button in top bar
2. Press it — modal confirms "Revoking all delegations"
3. All agent permissions gone instantly, confirmed on-chain
4. Reactivate to restore

**What to show**: The safety guarantee. One tap to pull the plug on everything.
**Key message**: You can never be locked out. You always have the override.
**Tech**: `OSKernel.revokeAll()` via 1Shot relay

---

### WF-03: System Health Check
**Route**: `/dashboard/status`
**Steps**:
1. Navigate to Status page
2. All 5 services display: AI brain (Venice), Transaction sender (1Shot), Blockchain network, Agent wallet, Payment history (subgraph)
3. Each shows status + latency in ms

**What to show**: ForgeOS is a multi-service orchestration platform — this page proves they're all live.
**Key message**: No black boxes. You can see the health of every dependency.
**Tech**: `/api/health` probing 5 endpoints in parallel

---

## Chapter 2: "Talk to Your OS" — The AI Command Layer

> The story: ForgeOS understands plain English and turns it into on-chain transactions — with human review before anything executes.

### WF-04: Natural Language → On-Chain Action
**Route**: Press `Cmd+K` anywhere in the dashboard
**Steps**:
1. Press `Cmd+K` to open command palette
2. Type: `check my portfolio balance`
3. Watch Venice AI reason → ActionPlan appears with step list + estimated cost
4. Click Execute → 1Shot submits the transaction
5. Webhook callback confirms → UI shows "Transaction confirmed"

**What to show**: The full loop — intent → AI plan → human approval → on-chain execution
**Key message**: You speak in English. ForgeOS handles the rest.
**Tech**: `/api/command` → Venice llama-3.3-70b → ActionPlan → `/api/a2a/execute` → 1Shot relay

---

### WF-05: A2A Payment Command
**Route**: `Cmd+K`
**Steps**:
1. Type: `send 10 USDC to 0xRecipientAddress`
2. ActionPlan shows both delegation hops: DeFiAgent coordinates, PaymentAgent executes
3. Estimated cost shown, Execute enabled
4. Execute → 2-hop delegation chain fires → 1Shot confirms

**What to show**: Agent-to-Agent coordination happens transparently inside a single user command.
**Key message**: Complex multi-agent coordination triggered by one sentence.
**Tech**: OSKernel → DeFiAgent sub-delegation → PaymentAgent re-delegation → `executePayment`

---

### WF-06: Policy Enforcement in Action
**Route**: `Cmd+K`
**Steps**:
1. Type: `send 1000 USDC` (exceeds the 500 USDC caveat cap)
2. ActionPlan appears but shows `policyViolations`
3. Execute button is grayed out — cannot proceed

**What to show**: Caveats enforce at the planning layer, before anything touches the chain.
**Key message**: The rules are enforced by math, not by trust.
**Tech**: `withinPolicy: false` + `policyViolations[]` from orchestrator caveat checker

---

### WF-07: AI Timing Transparency
**Route**: `Cmd+K` → run any command
**Steps**:
1. Submit any command
2. After response, bottom bar shows `{totalMs}ms total` including Venice latency

**What to show**: Venice response latency is visible. Nothing is hidden.
**Key message**: Full observability into your AI layer.
**Tech**: `FlowTiming` from `/api/command` response (`timing.totalMs`)

---

## Chapter 3: "Set Rules Once" — Delegations & Permissions

> The story: ForgeOS permissions are cryptographically enforced, fully transparent, and always user-controlled.

### WF-08: View the Delegation Tree
**Route**: `/dashboard/delegations`
**Steps**:
1. Navigate to Permissions page
2. See the visual delegation tree: User Wallet → OSKernel → DeFiAgent → PaymentAgent
3. Each node shows enforcer names, spend caps, method restrictions

**What to show**: The entire permission hierarchy in one view. Nothing hidden.
**Key message**: See exactly who can do what, down to the method selector level.
**Tech**: `DelegationTree` component reading from `useDelegations` → delegations store

---

### WF-09: Inspect Caveat Details
**Route**: `/dashboard/delegations` → expand a DelegationCard
**Steps**:
1. Open a delegation card
2. See decoded caveats: ERC20TransferAmountEnforcer (500 USDC cap), AllowedMethodsEnforcer (executeAction/redelegate only), LimitedCallsEnforcer

**What to show**: Every rule is on-chain. No interpretation, no trust required.
**Key message**: The delegation is a smart contract enforcer — not a policy document.
**Tech**: Decoded caveat terms from MetaMask smart-accounts-kit enforcer addresses

---

### WF-10: Revoke a Single Agent
**Route**: `/dashboard/delegations` → DelegationCard → Revoke
**Steps**:
1. Find any active delegation card
2. Click Revoke
3. Confirm — that agent loses access immediately
4. Parent and sibling delegations remain intact

**What to show**: Surgical permission removal without affecting other agents.
**Key message**: Granular control. Remove one agent without touching anything else.
**Tech**: `/api/delegations/revoke` → `OSKernel.revokeOne(delegationHash)`

---

### WF-11: Export Delegation Proof Bundle
**Route**: `/dashboard/delegations` → "Download backup" button
**Steps**:
1. Click "Download backup"
2. Downloads `forgeos-delegation-bundle.json`
3. Open it — shows full delegation chain as cryptographic proof objects

**What to show**: Permissions are portable cryptographic data, not locked in a database.
**Key message**: Your delegation bundle is your proof of authorization. Take it anywhere.
**Tech**: `exportProofBundle()` serializing delegations store to JSON

---

### WF-12: A2A Sub-delegation Auto-Creation
**Route**: `/dashboard/delegations` (immediately after activation)
**Steps**:
1. Complete OS activation (WF-01)
2. Navigate to Permissions page
3. OSKernel→DeFiAgent (hop 1) and DeFiAgent→PaymentAgent (hop 2) delegations appear — no second user signature

**What to show**: The full A2A chain self-assembles after a single user approval.
**Key message**: You signed once. ForgeOS built the entire agent network automatically.
**Tech**: `createOSSubDelegations()` in `auto-delegate.ts`, called post-activation

---

## Chapter 4: "Build Your Own Agents" — The No-Code Builder

> The story: ForgeOS is a platform, not just a product. Anyone can create and deploy agents — no code needed.

### WF-13: Build a DeFi Rebalancer
**Route**: `/dashboard/builder`
**Steps**:
1. Select "DeFi Rebalancer" template
2. Configure: BTC 50%, ETH 30%, USDC 20%, drift threshold 5%, max slippage 1%
3. Set spend cap: $500 USDC/run, run every hour
4. "Try it out" → preview Venice's simulated reasoning
5. "Grant access" → wallet signs the delegation
6. "Launch agent" → deploys with IPFS metadata URI shown in success screen

**What to show**: 6 steps, one wallet interaction, autonomous DeFi portfolio management.
**Key message**: No code. No scripts. One config form and your portfolio manages itself.
**Tech**: `useAgentBuilder` → `/api/agents/run` → IPFS pinning (Pinata or inline base64)

---

### WF-14: Build a Payment Executor
**Route**: `/dashboard/builder`
**Steps**:
1. Select "Payment Executor"
2. Add 3 recipient addresses
3. Set $10 USDC per recipient, daily frequency
4. CaveatPreview shows `LimitedCallsEnforcer: 5 max` + `ERC20TransferAmountEnforcer: 100 USDC`
5. Launch

**What to show**: Automated multi-recipient payroll with built-in spend caps.
**Key message**: Set up payroll in under 2 minutes. It runs itself.
**Tech**: LimitedCallsEnforcer + ERC20TransferAmountEnforcer displayed in `CaveatPreview`

---

### WF-15: Build an NFT Lifeguard
**Route**: `/dashboard/builder`
**Steps**:
1. Select "NFT Lifeguard"
2. Paste NFT collection address
3. Set floor threshold 15%, enable auto-list toggle
4. Runs every 30 minutes — monitors floor price and lists/delists automatically

**What to show**: Non-financial agent use case. NFT protection without custody transfer.
**Key message**: Your NFTs are protected even while you sleep.
**Tech**: AllowedTargetsEnforcer (marketplace contracts only) + AllowedMethodsEnforcer (list/delist only)

---

### WF-16: Build a Social Poster
**Route**: `/dashboard/builder`
**Steps**:
1. Select "Social Poster"
2. Platform: Lens Protocol, Tone: Degen, Max 3 posts/day
3. Launch — agent monitors portfolio events and posts when something interesting happens

**What to show**: Agents operate on social layers, not just financial ones.
**Key message**: Your on-chain activity becomes content automatically.
**Tech**: LimitedCallsEnforcer (3/activation) + AllowedTargetsEnforcer (Lens contracts only)

---

### WF-17: Build a Data Broker
**Route**: `/dashboard/builder`
**Steps**:
1. Select "Data Broker"
2. Enable "Data Monetization" toggle
3. Set tracked tokens: ETH, USDC, WBTC
4. Launch — agent collects analytics and earns revenue from the data marketplace

**What to show**: Agents can generate revenue for users — data-as-a-service on-chain.
**Key message**: Your portfolio data has value. ForgeOS helps you capture it.
**Tech**: Venice embeddings API (`text-embedding-ada-002`) + read-only `AllowedMethodsEnforcer`

---

### WF-18: Save and Resume a Draft
**Route**: `/dashboard/builder`
**Steps**:
1. Start configuring any agent
2. Click "Save for later"
3. Close the browser or navigate away
4. Return to builder → "Load draft" restores your configuration

**What to show**: Non-destructive workflow. Build at your own pace.
**Key message**: Your work is never lost.
**Tech**: `saveDraft()` / `loadDraft()` persisting to localStorage via `useAgentBuilder`

---

## Chapter 5: "Set It and Forget It" — Subscriptions & Treasury

> The story: ForgeOS handles recurring payments cryptographically. No bank, no cron job you babysit.

### WF-19: Create a Recurring Auto-Payment
**Route**: `/dashboard/subscriptions` → "+ Set up a new one"
**Steps**:
1. Name: "Monthly Aave Deposit"
2. Recipient: 0x... address
3. Amount: $10 USDC, every 30 days, 12 times
4. Submit → delegation created with TimestampEnforcer + ERC20TransferAmountEnforcer
5. Card appears showing cycle progress bar + next payment date

**What to show**: One form, one wallet sign, 12 months of automated payments.
**Key message**: Set it and genuinely forget it.
**Tech**: `/api/subscriptions/create` → sub-delegation with timestamp + amount enforcer

---

### WF-20: Trigger a Subscription Manually ("Run Now")
**Route**: `/dashboard/subscriptions` → active card → "Run Now"
**Steps**:
1. Find an active subscription card
2. Click "Run Now" — button shows spinner "Running..."
3. Execution confirmed — cycle count increments

**What to show**: Manual override is always available alongside automation.
**Key message**: Automation doesn't mean you lose control.
**Tech**: `/api/subscriptions/execute` → 1Shot relay

---

### WF-21: Cancel a Subscription
**Route**: `/dashboard/subscriptions` → active card → "Cancel"
**Steps**:
1. Click Cancel on any active subscription
2. The delegation is revoked on-chain
3. Card status changes to "Ended" — remaining payments can never happen

**What to show**: Cancellation is on-chain and immediate. No "pending cancellation" ambiguity.
**Key message**: Cancel means cancel. Not "we'll process that in 5-7 business days."
**Tech**: `/api/delegations/revoke` triggered from subscription cancel handler

---

### WF-22: View Real-Time Treasury Balance
**Route**: `/dashboard/treasury`
**Steps**:
1. Navigate to Money & Spending page
2. USDC balance reads directly from on-chain (not a database)
3. Donut chart shows: Available / Spent / Reserved
4. Daily spend bar chart shows 30-day history from subgraph

**What to show**: Real-time on-chain accounting. No trust-me-bro dashboard.
**Key message**: Your balance is always verified against the chain.
**Tech**: `readTreasuryBalance()` via Base Sepolia RPC + subgraph for history

---

### WF-23: Top Up Your Treasury
**Route**: `/dashboard/treasury` → "Add funds"
**Steps**:
1. Click "Add funds" — TopUpModal opens
2. Enter $50 USDC
3. Submits via 1Shot relay to `AgentTreasury.fund()`
4. Balance updates in real time after webhook confirmation

**What to show**: Gas-abstracted USDC deposit. No ETH needed for gas.
**Key message**: Funding your agents is as simple as a bank transfer.
**Tech**: `/api/relay/fund` → `AgentTreasury.fund()` via 1Shot ERC-7710

---

### WF-24: Revenue Split Transparency
**Route**: `/dashboard/treasury` → "How your earnings are split"
**Steps**:
1. Scroll to the earnings breakdown panel
2. Shows: 80% you keep, 15% auto-refills your balance, 5% platform fee
3. Dollar amounts shown for each category

**What to show**: Protocol economics are on-chain and immutable.
**Key message**: The fee structure is in the Solidity source code — not a terms-of-service PDF.
**Tech**: `USER_BPS=8000`, `REFILL_BPS=1500`, `PLATFORM_FEE_BPS=500` hardcoded in `AgentTreasury.sol`

---

## Chapter 6: "The Marketplace" — Discover & Install Community Agents

> The story: ForgeOS has a permissionless agent marketplace where every agent's rules are public.

### WF-25: Browse the Marketplace
**Route**: `/marketplace`
**Steps**:
1. Navigate to marketplace
2. Filter agents by category: DeFi / Payments / NFTs / Social / Data
3. Each card shows creator address, category badge, agent name

**What to show**: Open marketplace — anyone can publish, anyone can verify.
**Key message**: Agents are published to the blockchain, not to an app store.
**Tech**: Subgraph indexes `AgentRegistered` events from `ForgeOSRegistry`

---

### WF-26: Read an Agent's On-Chain Rules
**Route**: `/marketplace/[agentId]`
**Steps**:
1. Click any marketplace agent
2. See "What this agent can do" — each enforcer decoded (Spending limit, Allowed actions, Usage limit)
3. See the exact prompt template the agent will use
4. Creator address visible

**What to show**: Full transparency — rules are on-chain, prompts are public.
**Key message**: You know exactly what you're installing before you approve.
**Tech**: Caveat enforcer decoding + IPFS metadata fetch for prompt template

---

### WF-27: Install a Marketplace Agent
**Route**: `/marketplace/[agentId]` → "Add to my account"
**Steps**:
1. Click "Add to my account"
2. MetaMask opens — shows exactly what permission is being granted
3. Approve
4. Agent appears in `/dashboard/agents` with status "active"

**What to show**: One-click install with a cryptographic permission grant.
**Key message**: Installing an agent is not downloading software — it's granting a permission you can revoke.
**Tech**: `installAgent()` → creates delegation with the agent's caveat template from its IPFS metadata

---

## Quick Reference: All 27 Workflows

| # | Workflow | Chapter | Primary Tech |
|---|----------|---------|-------------|
| 01 | OS Activation | Setup | MetaMask Kit, EIP-7715 |
| 02 | Kill Switch | Setup | OSKernel.revokeAll |
| 03 | System Health Check | Setup | /api/health |
| 04 | Natural Language Command | AI Layer | Venice + 1Shot |
| 05 | A2A Payment Command | AI Layer | 2-hop delegation |
| 06 | Policy Block Demo | AI Layer | withinPolicy check |
| 07 | Timing Transparency | AI Layer | FlowTiming |
| 08 | View Delegation Tree | Permissions | DelegationTree |
| 09 | Inspect Caveat Details | Permissions | Enforcer decode |
| 10 | Revoke Single Agent | Permissions | OSKernel.revokeOne |
| 11 | Export Proof Bundle | Permissions | JSON export |
| 12 | A2A Auto Sub-delegation | Permissions | auto-delegate.ts |
| 13 | Build DeFi Rebalancer | Builder | AgentBuilder |
| 14 | Build Payment Executor | Builder | AgentBuilder |
| 15 | Build NFT Lifeguard | Builder | AgentBuilder |
| 16 | Build Social Poster | Builder | AgentBuilder |
| 17 | Build Data Broker | Builder | Venice embeddings |
| 18 | Save/Resume Draft | Builder | localStorage |
| 19 | Create Subscription | Subscriptions | TimestampEnforcer |
| 20 | Run Subscription Now | Subscriptions | 1Shot relay |
| 21 | Cancel Subscription | Subscriptions | OSKernel.revokeOne |
| 22 | Live Treasury Balance | Treasury | Base Sepolia RPC |
| 23 | Top Up Treasury | Treasury | 1Shot + AgentTreasury |
| 24 | Revenue Split View | Treasury | Solidity constants |
| 25 | Browse Marketplace | Marketplace | Subgraph |
| 26 | Inspect Agent Rules | Marketplace | Enforcer decode |
| 27 | Install Agent | Marketplace | MetaMask Kit |

---

## Recommended 10-Minute Demo Sequence

For judging or video recording, this sequence covers all 4 prize tracks:

1. **WF-01** — Activate OS (60s) — *MetaMask Smart Accounts track*
2. **WF-04** — Cmd+K natural language command (45s) — *Venice AI track*
3. **WF-05** — A2A payment command, show 2-hop chain (60s) — *Best A2A Coordination track*
4. **WF-08** — Delegation tree, show it self-assembled (30s)
5. **WF-13** — Build DeFi Rebalancer, launch (90s) — *Best Agent track*
6. **WF-23** — Top up treasury via 1Shot (30s) — *Best 1Shot Relayer track*
7. **WF-19** — Create auto-payment subscription (30s) — *Best x402 + ERC-7710 track*
8. **WF-02** — Kill Switch — end strong (15s)

**Total: ~6 minutes** with time for narration and transitions.
