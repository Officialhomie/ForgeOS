# Product Requirements Document (PRD)
**Product Name:** ForgeOS — No-Code Agent Marketplace + Zero-Knowledge Agent OS
**Version:** 1.1 (Updated for Implementation)
**Date:** May 27, 2026
**Hackathon:** MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off
**Deadline:** June 15, 2026 | Prize Announcement: June 22, 2026
**Platform:** HackQuest — https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-Kit-x-1Shot-API-x-Venice-AI-Dev-Cook-Off

**Related documents:** [TRD.md](./TRD.md) | [APP_FLOW.md](./APP_FLOW.md) | [UI_SPEC.md](./UI_SPEC.md) | [DATA_MODEL.md](./DATA_MODEL.md) | [IMPL.md](./IMPL.md) | [CHAINS.md](./CHAINS.md)

---

## 1. Executive Summary

ForgeOS is the first complete "App Store + iPhone" for autonomous on-chain agents.

- **No-Code Agent Marketplace** (v1): Drag-and-drop builder where non-devs create, publish, and monetize fully functional AI agents pre-wired to the exact stack (MetaMask Smart Accounts Kit + ERC-7710/7715 + Venice AI + 1Shot + x402).
- **Zero-Knowledge Agent OS** (v2 meta-product): A personal operating system that lives inside the user's MetaMask Smart Account. One master revocable delegation unlocks an ecosystem of sub-agents that collaborate privately, execute gaslessly, and self-fund via x402.

**Why this wins:**
The entire stack is live and production-proven in 2026 (verified via official MetaMask docs, Venice API, 1Shot public relayer, ERC-7710/7715 reference implementations, and native x402 support). No custom infrastructure needed. Every agent is:
- **Private** (Venice zero-retention)
- **Secure** (revocable 7710 delegations with enforceable caveats)
- **Gasless** (1Shot permissionless relayer)
- **Self-paying** (x402 micropayments)

**Business model:** Marketplace takes 10-15% x402 cut on every inference/execution. Creators keep the rest. OS treasury auto-compounds yield to fund operations.

---

## 2. Prize Track Alignment

| Track | Prize | How ForgeOS Qualifies |
|-------|-------|----------------------|
| Best x402 + ERC-7710 | $3,000 | ERC-7710 delegation drives all x402 subscription/streaming payments. Venice x402 loop in every inference. |
| Best Agent | $3,000 | Permissions are CENTRAL to UX. Kill switch, caveat tree, delegation-first design. |
| Best A2A Coordination | $3,000 | 2-hop redelegation chain: OSKernel → DeFiAgent → PaymentAgent. Fully autonomous. |
| Best Venice AI | $3,000 | Must qualify for a primary track first. Uses /v1/chat/completions + /v1/embeddings. Multi-endpoint. |
| Best 1Shot Relayer | $1,000 | Webhook callbacks (NOT polling) — explicit judging criterion. Every tx uses destinationUrl. |
| Best Social Media | $500 | Demo video + social posts |
| Best Feedback | $500 | User feedback submission |

**Total target: $16,000**

**Critical judging rules:**
- Smart Accounts Kit MUST appear in main demo flow — cosmetic integrations disqualified
- Venice AI track requires qualifying for one primary track first
- 1Shot webhook callbacks score higher than polling
- Judges can withhold prizes if no project meets their standards

---

## 3. Due Diligence Summary

Before writing this PRD every layer was verified against live 2026 sources:
- **MetaMask Smart Accounts Kit v1.5.0**: Official Viem-based SDK, full ERC-4337 + Delegation Framework support. Production on multiple EVM chains. Supports 7710/7715 natively.
- **Venice AI**: Privacy-first inference (zero logging/retention). OpenAI-compatible API + native x402 wallet payment (no API keys needed for agents). Models include Llama 3.3-70B, text-embedding-ada-002.
- **1Shot API**: Live permissionless gas relayer optimized for MetaMask Smart Accounts & EIP-7710. Pay in stablecoins (USDC/USDT). Confirmed 50%+ gas savings vs traditional 4337.
- **ERC-7710 (Delegation)**: Production implementations. MetaMask Delegation Toolkit provides caveat enforcers (spending limits, target contracts, time windows, sub-delegation chaining).
- **ERC-7715 (Permission Requests)**: Live in MetaMask Flask (`wallet_requestExecutionPermissions`). Clean wallet UX for scoped approvals. Sepolia only (not mainnet).
- **x402 Protocol**: Coinbase standard for HTTP-native on-chain micropayments. Venice integrated natively. Agents pay per-inference directly from Smart Account treasury. Base mainnet only, USDC.

**Risk level:** Low. Stack composes cleanly with zero overlapping responsibilities.

---

## 4. Problem Statement & Opportunity

**Problems solved:**
- Non-devs cannot build agents (requires deep 4337 + delegation + privacy + gas knowledge).
- Existing agents leak data to centralized AI, expose keys, or require gas/approvals per action.
- No unified "operating system" for on-chain life — fragmented UX and security.
- No easy monetization flywheel for agent creators.

**Opportunity:** Create the de-facto platform where any idea ("my personal DeFi agent", "NFT floor sniper", "creator treasury autopilot") becomes a shippable, secure, gasless, private agent in under 10 minutes.

---

## 5. Product Vision

**"One master approval. Infinite autonomous agents. Zero friction. Full privacy."**

ForgeOS turns every MetaMask Smart Account into a self-sustaining, privacy-first AI operating system powered by the live 2026 stack.

---

## 6. User Personas

| Persona | Goal | Pain Today |
|---------|------|-----------|
| Creator / Trader (non-dev) | Build & monetize a specialized agent | Requires Solidity, ERC-4337, delegation knowledge |
| Retail User (normie) | Agents that manage money, NFTs, bills without gas | Every dApp = separate approval + gas |
| DAO / Guild Treasurer | Collective treasury agents with enforceable rules | No programmable spending controls |
| Enterprise / Fintech | Compliance-shadow agents that never leak data | Centralized AI = data liability |

---

## 7. Core Features

### Phase 1 — No-Code Agent Marketplace

**Builder UI (Template-based, form-driven)**
- User picks from 5 built-in templates: DeFi Rebalancer, NFT Lifeguard, Payment Executor, Social Poster, Custom
- Configures: Venice prompt (editable), spend cap, interval, target contracts
- Builder auto-generates: Venice system prompt + ERC-7710 caveat JSON + UserOp skeleton
- Real-time caveat preview ("This agent can transfer max $500 USDC per call to Uniswap until Dec 2026")

**Permission Flow (ERC-7715 → 7710)**
- "Deploy Agent" → MetaMask Flask shows scoped approval UI
- User approves → signed ERC-7710 delegation with custom caveats created
- Delegation hash stored in agent config (key never exposed)
- Published agents ship with reusable delegation template for installers

**Execution Engine**
- Venice → structured JSON action plan → Smart Accounts Kit → `redeemDelegations()` UserOps → 1Shot relay (gasless)
- x402 micropayment attached to every Venice inference (agent treasury pays Venice + 10-15% marketplace cut)

**Marketplace**
- Browse all `AgentRegistered` on-chain events from ForgeOSRegistry
- Categories: DeFi, NFT, Payments, Social, Custom
- Install = one ERC-7715 approval reusing agent's caveat template
- Creator earnings visible on-chain

### Phase 2 — Zero-Knowledge Agent OS

**OS Kernel** = User's MetaMask Smart Account (activated once via the 4-step wizard)

**Master Delegation (one-time ERC-7715)**
- Global caveats: monthly spend cap $500 USDC, allowed categories, 1-year expiry
- OS contract (OSKernel.sol) receives root ERC-7710 delegation
- Sub-agents chain scoped sub-delegations off root without new user signatures

**Sub-Agent System (5 built-in agents)**
- Pre-installed: defi-rebalancer, nft-lifeguard, payment-executor, social-poster, data-broker
- Marketplace agents install as sub-agents (zero extra approvals)
- Agent runtime loop: timer-triggered execution every N minutes via Vercel Cron

**Private Reasoning Fabric**
- All sub-agents route through Venice (zero logs, x402 payment per call)
- Natural language command bar: "OS, rebalance portfolio and pay subscription"
- Full round-trip: command → Venice plan → delegation injection → 1Shot relay → SSE confirmation

**Self-Sustaining Economy**
- Agent Treasury funded once by user
- x402 routes per execution: 80% user, 15% treasury refill, 5% marketplace cut
- 1Shot makes every agent action gasless

**Dashboard & Controls**
- Live agent status, earnings, delegation tree
- Kill switch: one click calls `OSKernel.revokeAll()` → all sub-delegations die atomically
- On-chain audit trail (The Graph subgraph when configured, RPC fallback)

---

## 8. Technical Architecture

```
User → MetaMask Flask (Smart Account)
   ↓ (wallet_requestExecutionPermissions — ERC-7715)
OSKernel.sol → signed ERC-7710 root delegation
   ↓ (auto sub-delegation creation)
Sub-agents (DeFiAgent, PaymentAgent, etc.)
   ↓ (trigger: cron / command / event)
Venice AI (x402 USDC payment per call → zero logs)
   ↓ (structured JSON action plan)
redeemDelegations() calldata encoding (viem)
   ↓
1Shot relayer → getCapabilities → getFeeData → send7710Transaction
   ↓ (webhook → /api/webhooks/1shot)
EntryPoint → Smart Account executes (caveats enforced on-chain)
   ↓
SSE stream (/api/events) → Dashboard live update
```

**Key Constraints:**
- ERC-7715 Flask = Sepolia ONLY (chain 11155111)
- Venice x402 = Base mainnet ONLY (chain 8453), USDC
- 1Shot = Sepolia for contracts, Base for Venice payments
- Never use ERC20.approve() or permit() — delegation-only payment model

---

## 9. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| End-to-end action latency | < 8 seconds (Venice ~2-4s + 1Shot <2s) |
| UserOp batching | Up to 10 actions per UserOp |
| Privacy | Venice zero-retention architectural guarantee |
| Security | Agent never holds keys. All power = revocable 7710 delegations. |
| Gasless | User never pays gas. 1Shot sponsors all ops in USDC. |
| Multi-chain | 1Shot + MetaMask support multiple EVMs |
| Uptime | 99.9% leveraging MetaMask + 1Shot production infra |

---

## 10. Monetization & Economics

- Marketplace cut: 5% (PLATFORM_FEE_BPS = 500) of every AgentTreasury.executePayment() — on-chain, automatic
- Treasury refill pool: 15% (REFILL_BPS = 1500) auto-routes back to treasury
- User net: 80% (USER_BPS = 8000) of payment amount
- Optional: premium templates, verified agent badges

---

## 11. Roadmap & MVP Scope

| Phase | Scope | Status |
|-------|-------|--------|
| MVP (hackathon) | Activation wizard + master delegation + A2A execution + builder + marketplace browse | In Progress |
| Post-hackathon | Full OS with 5 sub-agents autonomous + marketplace monetization analytics | Planned |
| Phase 3 | Multi-chain + enterprise compliance agents + DAO treasury tooling | Future |

**In scope for hackathon:**
- 4-step activation wizard (complete)
- ERC-7715 master delegation (complete)
- Venice x402 inference (complete)
- 1Shot relay + webhook (complete)
- A2A 2-hop delegation chain (complete)
- Kill switch (complete)
- UserOp `redeemDelegations` encoding fix (Phase 1)
- Auto sub-delegation creation (Phase 2)
- Command → Execute full pipeline (Phase 3)
- Agent runtime cron trigger (Phase 4)
- Form-based builder UI (Phase 5)
- Marketplace browse + install (Phase 6)
- Treasury top-up wiring (Phase 7)

**Out of scope for hackathon:**
- Drag-and-drop visual builder (React Flow)
- The Graph subgraph deployment
- Turnkey HSM for production key management (code exists, not required for demo)
- Mainnet deployment

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| ERC-7715 Flask Sepolia-only | Documented constraint. All activation locked to Sepolia. |
| Venice downtime | VenicePaymentRequired error caught. Fallback error UI implemented. |
| 1Shot relay congestion | Webhook-based confirmation (not polling). Error surfaced to user. |
| MetaMask dual extension conflict | Detected in useActivation — dual-extension check with clear error message. |
| UserOps not ERC-4337 compliant | Phase 1 of IMPL.md — encode redeemDelegations calldata. |
| Sub-delegations never created | Phase 2 of IMPL.md — useSubDelegations hook. |
| User education on delegations | Crystal-clear MetaMask UX + caveat preview + human-readable summaries. |

---

## 13. Success Metrics (Hackathon)

- Master OS activation works end-to-end in < 15s
- A2A 2-hop execution confirmed on-chain (Sepolia)
- Venice x402 payment recorded on Base mainnet
- 1Shot webhook delivers confirmation (not polling)
- Builder produces a valid agent with custom caveats
- Marketplace shows at least 1 published agent installable via ERC-7715
- Kill switch revokes all delegations atomically in < 3s

---

## 14. Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Activation wizard (4 steps) | DONE | Flask-guarded, resumable, persisted |
| ERC-7715 delegation signing | DONE | buildActivationPermissions, erc7715ProviderActions |
| Venice x402 loop | DONE | SIWE auth, 402 payment, retry |
| 1Shot relay client | DONE | caps → fee → send7710Transaction |
| Webhook + SSE | DONE | Ed25519 verified, activityEmitter |
| A2A orchestrator | DONE | 2-hop plan, intent parser, agent router |
| Kill switch | DONE | revokeAll via 1Shot, optimistic UI |
| UserOp redeemDelegations encoding | TODO | Phase 1 |
| Auto sub-delegation creation | TODO | Phase 2 |
| Command → Execute pipeline | TODO | Phase 3 |
| Agent runtime cron | TODO | Phase 4 |
| Builder UI | TODO | Phase 5 |
| Marketplace | TODO | Phase 6 |
| Treasury top-up | TODO | Phase 7 |
| Project documents | IN PROGRESS | This file + TRD + APP_FLOW + UI_SPEC + DATA_MODEL + IMPL |
