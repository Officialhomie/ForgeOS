# ForgeOS

**The on-chain spending firewall for autonomous agents.**

Give an agent the authority to act — not the keys to everything. Authority narrows cryptographically at every hop: the user grants one scoped, revocable ERC-7715 permission; every sub-delegation an agent creates from it can only shrink in scope, never grow; and one kill switch revokes the entire tree on-chain. Built on MetaMask Smart Accounts (ERC-7710/7715), Venice AI zero-retention inference paid per-call over x402, and 1Shot gasless relay.

The marketplace and no-code builder exist to demonstrate the primitive: any agent assembled in the builder ships with the same enforcer-backed caveats, and any agent in the marketplace runs inside the same firewall.

---

## Hackathon Context

**MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off**
**Deadline:** June 15, 2026 | **Prize Announcement:** June 22, 2026
**Platform:** [HackQuest](https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-Kit-x-1Shot-API-x-Venice-AI-Dev-Cook-Off)

### Track Mapping

| Track | What ForgeOS demonstrates |
|-------|---------------------------|
| Best x402 + ERC-7710 | A narrowing ERC-7710 delegation chain funds live Venice x402 USDC micropayments on Base — delegation-scoped authority paying for real inference |
| Best Agent | Permissions are the UX, not a checkbox: scoped ERC-7715 approval in the activation wizard, per-agent caveats visible in the UI, an always-visible kill switch, and a state machine that refuses to show "Confirmed" without a webhook or receipt behind it |
| Best A2A Coordination | A 2-hop narrowing capability chain: Orchestrator → DeFiAgent (500 USDC cap) → PaymentAgent (100 USDC cap, 1 call) — each hop created without a new user signature, each provably narrower |
| Best Venice AI | Live zero-retention inference in the main loop: Venice chat parses intents into action plans, paid per-call with real x402 USDC on Base |
| Best 1Shot Relayer | Gasless ERC-7710 relay with webhook-driven confirmation (Ed25519-verified) → SSE → UI; no polling |

---

## Quick Start

```bash
git clone <repo>
cd ForgeOS
cp .env.example app/.env.local
# Fill in (see comments in the file for what breaks without each):
#   ONESHOT_API_KEY, ONESHOT_WEBHOOK_SECRET, AGENT_WALLET_KEY,
#   FORGE_OWNER_KEY, CRON_SECRET, FORGE_SMART_ACCOUNT_ADDRESS,
#   NEXT_PUBLIC_DEFI_AGENT_ADDRESS, NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS
cd app
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and check **/dashboard/status** — every dependency shows red/green, including presence checks for the server-side secrets. MetaMask Flask is required for ERC-7715 (Sepolia only, chain 11155111).

---

## Architecture

```
User → MetaMask Flask (scoped ERC-7715 approval — the ONLY signature the user gives)
  ↓
Root ERC-7710 delegation (spend cap + allowed methods + expiry caveats)
  ↓ auto sub-delegation — caveats can only narrow
Sub-agents (DeFiAgent 500 USDC cap → PaymentAgent 100 USDC cap, 1 call)
  ↓ cron / command / event trigger
Venice AI chat (paid per-call: x402 USDC on Base, zero retention)
  ↓ structured JSON action plan (validated: no zero/placeholder targets)
1Shot relayer ← raw executions + delegation chain as permissionContext
  ↓ relayer performs the ERC-7710 redemption, gasless
  ↓ Ed25519-verified webhook → /api/webhooks/1shot
SSE stream → Dashboard ("Confirmed" only after the webhook delivers a txHash)
```

**Enforcement layers (kept distinct — see [CLAIMS.md](./CLAIMS.md)):**
1. **Creation-time narrowing (on-chain):** `OSKernel.redelegate()` reverts `CaveatWideningNotAllowed` for any sub-delegation that widens its parent's scope.
2. **Treasury bounds (on-chain, execution-time):** `AgentTreasury` checks `isDelegationActive`, per-agent budget, and per-user balance before any spend.
3. **Caveat enforcers (delegation framework):** delegations carry verified Sepolia enforcer contracts (`ERC20TransferAmountEnforcer` etc. — see `CHAINS.md`); the 1Shot relayer redeems delegations through the MetaMask DelegationManager.

**Chain strategy:**
- Ethereum Sepolia (11155111): contracts, ERC-7715, 1Shot relay
- Base mainnet (8453): Venice x402 USDC payments only

---

## Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| OSKernel | `0xa4bD3e0946431dFA0C38F700f5935E03b749C77C` |
| AgentTreasury | `0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429` |
| ForgeOSRegistry | `0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68` |

OSKernel implements the ERC-7710 delegation lifecycle with on-chain narrowing validation for this demo, designed to pair with MetaMask's EIP7702DeleGatorCore in production.

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Activation wizard (4 steps, ERC-7715) | DONE |
| Venice x402 inference loop (Base USDC) | DONE |
| 1Shot relay client + webhook + SSE | DONE |
| A2A orchestrator (2-hop chain) | DONE |
| Kill switch (`revokeAll`, owner-verified on Sepolia) | DONE |
| UserOp / redeem encoding + relay submission | DONE — relay encoding fixed & probe-verified 2026-06-10 |
| Auto sub-delegation creation | DONE |
| Command → Execute pipeline | DONE |
| Agent runtime cron | DONE |
| No-code Builder UI (real enforcer addresses) | DONE |
| Marketplace | Preview — UI complete, listings not yet on-chain-verified |
| Treasury top-up wiring | DONE — on-chain `fund` txs verified |
| 3× golden-path demo verification | In progress — see `SHIP_AUDIT.md` |

See [SHIP_AUDIT.md](./SHIP_AUDIT.md) for the evidence behind every row, [CLAIMS.md](./CLAIMS.md) for exactly what we claim and don't, and [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the demo walkthrough.

---

## Document Index

| Document | Purpose |
|----------|---------|
| [CLAIMS.md](./CLAIMS.md) | What is claimed, what is conditional, what is forbidden |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Golden-path demo walkthrough with narration |
| [SHIP_AUDIT.md](./SHIP_AUDIT.md) | Ground-truth audit + remediation log with evidence |
| [PRD.md](./PRD.md) | Product requirements, prize tracks, user personas |
| [TRD.md](./TRD.md) | Operational flows, encoding spec, API routes, env vars |
| [APP_FLOW.md](./APP_FLOW.md) | Screen inventory, navigation map, user journeys |
| [UI_SPEC.md](./UI_SPEC.md) | Design tokens, typography, status color rules |
| [DATA_MODEL.md](./DATA_MODEL.md) | TypeScript types, store shapes, API contracts |
| [CHAINS.md](./CHAINS.md) | Chain strategy, contract + enforcer addresses, deploy commands |

---

## Monorepo Structure

```
ForgeOS/
├── app/                 # Next.js 15 frontend + API routes
│   ├── src/
│   │   ├── app/         # App Router pages + API routes
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── lib/         # Venice, 1Shot, delegation libs
│   │   ├── services/    # Orchestrator, execution engine
│   │   ├── stores/      # Zustand state stores
│   │   └── types/       # TypeScript types
│   └── scripts/         # Verification scripts (target guard, relay probe)
├── contracts/           # Foundry smart contracts
│   ├── src/             # OSKernel.sol, AgentTreasury.sol, ForgeOSRegistry.sol
│   ├── test/            # Foundry tests (12/12 passing)
│   └── script/          # Deploy + FirewallMoment evidence scripts
└── subgraph/            # Delegation lifecycle indexing
```
