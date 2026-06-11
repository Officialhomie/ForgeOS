# SUBMISSION.md — ForgeOS

**The on-chain spending firewall for autonomous agents.**
MetaMask Smart Accounts Kit x 1Shot API x Venice AI Dev Cook Off — June 2026.

---

## Contracts (Ethereum Sepolia, 11155111)

| Contract | Etherscan |
|----------|-----------|
| OSKernel | https://sepolia.etherscan.io/address/0xa4bD3e0946431dFA0C38F700f5935E03b749C77C |
| AgentTreasury | https://sepolia.etherscan.io/address/0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429 |
| ForgeOSRegistry | https://sepolia.etherscan.io/address/0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68 |

Caveat enforcers used by agent templates are the MetaMask Delegation Framework's official
Sepolia deployments, each bytecode-verified — full list in `CHAINS.md` (SEPOLIA_ENFORCERS).

## Evidence transactions

| Evidence | Tx hash |
|----------|---------|
| Treasury `fund` (on-chain USDC into AgentTreasury) | https://sepolia.etherscan.io/tx/0x703a439ce4ca8e532c58914eb50474583de1b35e85f2ad7219c2c9e6edde0501 |
| Widening redelegation REVERT (`CaveatWideningNotAllowed`) | _pending — produced by `contracts/script/FirewallMoment.s.sol`, recorded in SHIP_AUDIT.md_ |
| Narrowing redelegation ACCEPTED | _pending — same script_ |
| Golden-path gasless execution (webhook-confirmed) | _pending — recorded during 3× demo runs_ |
| Kill switch `revokeAll` receipt | _pending — recorded during 3× demo runs_ |

## Demo

- Demo video: follows `DEMO_SCRIPT.md` step-for-step (activation → delegation tree +
  firewall revert → Venice x402 inference → 1Shot gasless execution → A2A 2-hop → kill switch).
- Hosted demo: _add URL if deployed; local quick start in README works from a fresh clone
  (verified 2026-06-10: clone → install → build → dashboard with truthful readiness page)._

## Track mapping

| Track | Evidence |
|-------|----------|
| Best x402 + ERC-7710 | Narrowing ERC-7710 chain funds live Venice x402 USDC payments (Base mainnet, chain 8453) |
| Best Agent | Scoped ERC-7715 activation, per-agent caveats with verified enforcers, always-visible kill switch, truthful state machine (Confirmed only after webhook/receipt) |
| Best A2A Coordination | 2-hop narrowing capability chain (root → DeFiAgent 500 USDC → PaymentAgent 100 USDC / 1 call), creation-time widening reverts on-chain |
| Best Venice AI | Zero-retention chat inference in the main loop, paid per-call via x402 |
| Best 1Shot Relayer | `relayer_send7710Transaction` + Ed25519-verified webhook → SSE pipeline; webhook-driven, no polling |

## Known Limitations (stated plainly)

- **Sepolia-only ERC-7715.** MetaMask Flask grants ERC-7715 permissions on Sepolia only;
  the single mainnet component is x402 USDC payment on Base.
- **Execution-time caveat redemption status.** Per the SHIP_AUDIT.md "Redeem Decision":
  the 1Shot relayer performs the ERC-7710 redemption from the supplied delegation chain
  (probe-verified 2026-06-10, relay encoding fixed). A successful on-chain redemption trace
  plus a cap-exceeding enforcer revert are pending the golden-path runs; until both hashes
  are recorded, we claim treasury-level execution-time bounds and creation-time narrowing —
  not execution-time caveat enforcement (see CLAIMS.md).
- **OSKernel is the demo lifecycle kernel.** It implements the ERC-7710 delegation lifecycle
  with on-chain narrowing validation, designed to pair with MetaMask's EIP7702DeleGatorCore
  in production; it is not the production MetaMask DelegationManager.
- **Marketplace is a preview.** UI complete; listings not yet on-chain-verified.
- **Subgraph re-publish in progress.** UI falls back to RPC log scan meanwhile.

## Verification commands

```bash
cd contracts && forge test          # 12/12
cd app && pnpm build                # clean, 35 routes
npx -y tsx scripts/test-target-guard.ts   # 7/7 honest-failure checks
```
