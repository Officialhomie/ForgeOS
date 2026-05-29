# ForgeOS

**The first complete "App Store + iPhone" for autonomous on-chain agents.**

ForgeOS turns every MetaMask Smart Account into a self-sustaining, privacy-first AI operating system — powered by ERC-7710/7715 delegations, Venice AI zero-retention inference, 1Shot gasless relay, and x402 micropayments.

---

## Hackathon Context

**MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off**
**Deadline:** June 15, 2026 | **Prize Announcement:** June 22, 2026
**Platform:** [HackQuest](https://www.hackquest.io/hackathons/MetaMask-Smart-Accounts-Kit-x-1Shot-API-x-Venice-AI-Dev-Cook-Off)
**Target prize:** $16,000 across 7 tracks

| Track | Prize |
|-------|-------|
| Best x402 + ERC-7710 | $3,000 |
| Best Agent | $3,000 |
| Best A2A Coordination | $3,000 |
| Best Venice AI | $3,000 |
| Best 1Shot Relayer | $1,000 |
| Best Social Media | $500 |
| Best Feedback | $500 |

---

## Quick Start

```bash
cd app
pnpm install
cp .env.example .env.local
# Fill in: ONESHOT_API_KEY, AGENT_WALLET_KEY, ONESHOT_WEBHOOK_SECRET
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). MetaMask Flask must be installed and set to Sepolia (11155111).

---

## Architecture

```
User → MetaMask Flask (ERC-7715 approval)
  ↓
OSKernel.sol → signed ERC-7710 root delegation
  ↓ (auto sub-delegation)
Sub-agents (DeFiAgent, PaymentAgent)
  ↓ (cron / command / event trigger)
Venice AI (x402 USDC payment → zero logs)
  ↓ (structured JSON action plan)
redeemDelegations() calldata (viem)
  ↓
1Shot relayer → gasless ERC-4337 UserOp
  ↓ (webhook → /api/webhooks/1shot)
EntryPoint → Smart Account executes (caveats enforced on-chain)
  ↓
SSE stream → Dashboard live update
```

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

---

## Document Index

| Document | Purpose |
|----------|---------|
| [PRD.md](./PRD.md) | Product requirements, prize tracks, user personas, success metrics |
| [TRD.md](./TRD.md) | All 12 operational flows, ERC-4337 encoding spec, API routes, env vars |
| [APP_FLOW.md](./APP_FLOW.md) | Screen inventory, navigation map, 5 user journeys, component architecture |
| [UI_SPEC.md](./UI_SPEC.md) | Design tokens, typography, component specs, status color rules |
| [DATA_MODEL.md](./DATA_MODEL.md) | TypeScript types, Zustand store shapes, API contracts |
| [IMPL.md](./IMPL.md) | Living implementation plan — phase status, pickup instructions, risk flags |
| [CHAINS.md](./CHAINS.md) | Chain strategy, deployed contract addresses, deploy commands |

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
│   └── package.json
├── contracts/           # Foundry smart contracts
│   ├── src/             # OSKernel.sol, AgentTreasury.sol, ForgeOSRegistry.sol
│   ├── test/            # Foundry tests
│   └── script/          # Deploy scripts
├── PRD.md
├── TRD.md
├── APP_FLOW.md
├── UI_SPEC.md
├── DATA_MODEL.md
├── IMPL.md
└── CHAINS.md
```

---

## Implementation Status

| Component | Status |
|-----------|--------|
| Activation wizard (4 steps) | DONE |
| ERC-7715 delegation signing | DONE |
| Venice x402 inference loop | DONE |
| 1Shot relay client | DONE |
| Webhook + SSE pipeline | DONE |
| A2A orchestrator | DONE |
| Kill switch | DONE |
| UserOp redeemDelegations encoding | TODO (Phase 1) |
| Auto sub-delegation creation | TODO (Phase 2) |
| Command → Execute pipeline | TODO (Phase 3) |
| Agent runtime cron | TODO (Phase 4) |
| No-code Builder UI | TODO (Phase 5) |
| Marketplace | TODO (Phase 6) |
| Treasury top-up wiring | TODO (Phase 7) |

See [IMPL.md](./IMPL.md) for detailed pickup instructions per phase.
