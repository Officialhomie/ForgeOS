# SHIP_AUDIT.md — ForgeOS Phase 0 Ground Truth Audit

**Generated:** 2026-06-09
**Auditor:** Claude Sonnet 4.6 (Phase 0 automated audit)
**Branch:** main

---

## 1. Build Status

| Target | Command | Result | Evidence |
|--------|---------|--------|---------|
| Contracts compile | `cd contracts && forge build` | **CLEAN** | No errors; lint notes only (immutable naming style, unchecked ERC20 transfer in mock) |
| Contracts tests | `cd contracts && forge test` | **ALL PASS** | 12/12 tests: AgentTreasury (3), OSKernel (2), DelegationChain (2), ForgeOSRegistry (4), x402Subscription (1) |
| App compile + types | `cd app && pnpm build` | **CLEAN** | 35 routes built; TypeScript completed in 15.2s with 0 errors |

**Conclusion: Phases 0–1 of the ship prompt are pre-resolved. The build is not blocking.**

---

## 2. Implementation Status vs. IMPL.md

IMPL.md and README list Phases 1–7 as TODO. **This is stale.** All phases up to Phase 5 have substantially implemented code in the repository.

| IMPL Phase | README/IMPL claim | Actual state |
|-----------|------------------|--------------|
| Phase 1 — UserOp redeemDelegations encoding | TODO | **DONE** — `encode-redeem.ts` fully implemented; `userop-builder.ts` calls `encodeRedeemDelegations()` and validates 4-byte selector |
| Phase 2 — Auto sub-delegation creation | TODO | **DONE** — `useSubDelegations.ts` creates 2-hop chain, relays via `/api/relay/redelegate`, stores in `delegations.store` |
| Phase 3 — Command → Execute pipeline | TODO | **DONE** — `useAgentExecute.ts` exists; `useCommandBar.ts` wires intent → plan → execute → SSE |
| Phase 4 — Agent runtime cron | TODO | **DONE** — `/api/cron/agent-runner/route.ts` exists, `vercel.json` cron schedule exists |
| Phase 5 — No-code Builder UI | TODO | **DONE** — `dashboard/builder/page.tsx` exists with 3-step flow |
| Phase 6 — Marketplace | TODO | **DONE** — `marketplace/page.tsx` and `marketplace/[agentId]/page.tsx` exist |
| Phase 7 — Treasury top-up | TODO | **DONE** — `relay/fund/route.ts` exists with ABI-encoded calldata |

**Action required:** README.md implementation table must be updated to reflect actual state before submission — a judge reading it will expect far less than what exists.

---

## 3. Production-Reachable Dishonesty / Fake Data

These are issues where non-guarded code may present false information to a real user or judge.

### H1 — "zero-knowledge control" in social OG image [MUST FIX]

| Field | Value |
|-------|-------|
| File | `app/src/app/twitter-image.tsx:74` |
| Text | `"Spending limits, granular permissions, zero-knowledge control."` |
| Problem | Implies ZK cryptographic guarantees. Venice zero-retention is a privacy policy, not ZK. This image is rendered server-side and is publicly visible on every Twitter/X share. |
| Classification | **Production-reachable** |
| Fix | Change to `"cryptographically scoped permissions, zero-retention AI"` or similar honest formulation |

---

### H2 — Placeholder enforcer addresses in agent templates [MUST FIX]

| Field | Value |
|-------|-------|
| File | `app/src/lib/agents/templates.ts:50-55` |
| Code | `ENFORCERS = { erc20TransferAmount: '0x0000…0001', allowedMethods: '0x0000…0002', … }` |
| Problem | These are `0x000…001` through `0x000…006` — no contracts at these addresses on Sepolia. Any delegation built by the Builder UI or cron agent runner with these caveats will fail on-chain when the enforcer is called during `redeemDelegations`. The file comment reads "Replace with actual deployed addresses for production." |
| Classification | **Production-reachable** (builder UI and `/api/agents/run` use template caveats) |
| Fix | Populate `ENFORCERS` with the actual MetaMask Delegation Framework enforcer addresses deployed on Sepolia. These are available in `contracts/lib/@metamask/delegation-framework/` — read the addresses from the package's address registry, or add them to `CHAINS.md` and import from there. |

---

### H3 — Intent parser fallback uses zero address as transaction target [MUST FIX]

| Field | Value |
|-------|-------|
| File | `app/src/services/orchestrator/intent-parser.ts:181,198` |
| Code | `target: (a.target as Address) ?? '0x0000000000000000000000000000000000000000'` |
| Problem | If Venice returns an action without a target address (or if parsing fails), the UserOp will be submitted to `0x0000…0000`. This is a valid-looking but wrong transaction. The system prompt also uses `0x0000…0001` and `0x000…0002` as example targets — Venice may echo these back verbatim if it doesn't substitute real addresses. |
| Classification | **Production-reachable** |
| Fix | Add a guard: if `a.target` is null/zero/`0x0000…0000`, throw a `DelegationProofError` with message `"action.target is missing or zero address"` so `buildAndValidateUserOps` returns a clean 422 rather than a bad UserOp. |

---

### H4 — README implementation status table is stale [MUST FIX before submission]

| Field | Value |
|-------|-------|
| File | `README.md:132-140` |
| Problem | Lists 7 items as TODO that are all implemented. A judge reading README will conclude the project is far less complete than it is. |
| Classification | **Production-reachable** (README is public) |
| Fix | Update the status table to reflect actual completion. For items that are implemented but not yet demo-verified, mark "DONE (untested)" — still more accurate than TODO. |

---

## 4. Dev-Only Issues (Production-Guarded — Acceptable)

These exist but are not reachable in a production build with `NEXT_PUBLIC_DEMO_MODE` unset.

| ID | Location | Issue | Guard |
|----|----------|-------|-------|
| D1 | `app/src/lib/mock-data.ts:304,317,330,343` | `ActivityEvent` entries with `status: 'confirmed'` and `source: 'local'` — confirmed events should have `source: 'webhook'` | `hydrateDemoStores()` only called when `isDemoMode()` returns true; hard guard blocks it in production builds |
| D2 | `app/src/lib/mock-data.ts` (all) | Fake hashes (`0xROOT000…`, `0xDEFI000…`) with readable suffixes — not real on-chain hashes | Same demo mode guard |
| D3 | `app/src/lib/activation/stale-state.ts:31` | Stale detection checks for `demo-` prefix on `oneShotTaskId` | Server-side staleness check — only reaches production if demo task IDs were stored, which requires demo mode |

---

## 5. Low-Risk Design Observations (No Fix Required)

| ID | Location | Observation |
|----|----------|-------------|
| L1 | All API routes (`/api/execute`, `/api/a2a/execute`, `/api/agents/run`, `/api/command`, `x402-meter.ts`) | `source: 'local'` on pending activity events — these all have `status: 'pending'` and correctly transition to `source: 'webhook'` on confirmation. This is semantically correct: the event was generated server-side at submission time, before the relay responds. No fix needed. |
| L2 | `app/src/lib/delegation/encode-redeem.ts:27` | `MODE_DEFAULT = 0x000…0` — this is the correct ERC-7579 execution mode for single-call execution, not a zero-address placeholder. |
| L3 | `app/src/lib/graph/mappers.ts:87,89` | Zero-padded salt/signature in subgraph mappers — these are defaults for delegations indexed from on-chain events where these fields may be empty. Acceptable. |

---

## 6. Missing Environment Variables (Not in .env.example)

These env vars are consumed by production code but absent from `.env.example`. A fresh clone will silently fail on golden-path steps that require them.

| Variable | Used by | Effect if missing |
|----------|---------|-------------------|
| `NEXT_PUBLIC_DEFI_AGENT_ADDRESS` | `useSubDelegations.ts:108` | Sub-delegation chain not created; A2A path breaks silently |
| `NEXT_PUBLIC_PAYMENT_AGENT_ADDRESS` | `useSubDelegations.ts:109` | Same |
| `FORGE_OWNER_KEY` | `/api/relay/revoke-all`, `/api/relay/revoke` | Kill switch returns 503 — golden path step 6 fails |
| `CRON_SECRET` | `/api/cron/agent-runner`, `/api/delegations/bundle` | Cron endpoint rejects all calls; bundle upload returns 401 |
| `FORGE_SMART_ACCOUNT_ADDRESS` | `/api/cron/agent-runner`, `/api/agents/run` | Cron can't look up delegation bundle — agents don't fire |

**Action required:** Add all five to `.env.example` with descriptive comments before submission.

---

## 7. Known On-Chain Risk: OSKernel Ownership

Per `CHAINS.md`: "OSKernel.owner() was set to Foundry's DefaultSender (0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38) in simulation; on-chain owner may differ."

The kill switch (`revokeAll`) is `onlyOwner`. If `FORGE_OWNER_KEY` in `.env.local` does not correspond to the actual on-chain owner of the deployed `OSKernel`, the kill switch step will revert silently.

**Action required before golden-path demo:** Call `OSKernel.owner()` on Sepolia via cast or Etherscan and confirm it matches the wallet controlled by `FORGE_OWNER_KEY`.

---

## 8. Redeem Decision Pre-Assessment

Per the ship prompt, Phase 2 requires a decision on whether to pursue live `redeemDelegations` execution via UserOp.

**Current state:**
- `encode-redeem.ts` is implemented — the callData encoding is correct
- `userop-builder.ts` calls `encodeRedeemDelegations` and validates the 4-byte selector
- The encoding is correct per the DeleGatorCore ABI

**The open question:** For `redeemDelegations` to be enforced on-chain, the UserOp `sender` must be a smart account that implements `DeleGatorCore.redeemDelegations()`. The OSKernel contracts deployed on Sepolia are the ForgeOS demo kernel — not the MetaMask EIP-7702 DeleGatorCore. Whether the ERC-4337 EntryPoint will route the UserOp correctly to `redeemDelegations` depends on:
1. The `sender` address being a deployed/delegated account that implements `redeemDelegations`
2. The 1Shot relay correctly routing `send7710Transaction` with the encoded callData

**Recommendation:** During demo prep (Phase 3 hardening), submit one test UserOp with the encoded callData and check the Sepolia Etherscan trace. If the `redeemDelegations` call appears in the trace, execution-time enforcement is live. If not, fall back to the creation-time narrowing demo as specified in Phase 2 Fallback.

---

## 9. Worklist Summary

| ID | Severity | File | Fix | Phase |
|----|----------|------|-----|-------|
| H1 | HIGH | `app/src/app/twitter-image.tsx:74` | Remove "zero-knowledge" claim | Phase 4 (Claims) |
| H2 | HIGH | `app/src/lib/agents/templates.ts:50-55` | **FIXED 2026-06-10** — see Remediation Log | Phase 1 |
| H3 | HIGH | `app/src/services/orchestrator/intent-parser.ts:181,198` | **FIXED 2026-06-10** — see Remediation Log | Phase 1 |
| H4 | HIGH | `README.md:132-140` | Update implementation status table | Phase 4 |
| ENV1 | MEDIUM | `app/.env.example` | Add 5 missing env vars with comments | Phase 3 |
| OC1 | MEDIUM | OSKernel on-chain owner | Verify owner == `FORGE_OWNER_KEY` wallet | Phase 3 pre-check |
| D1 | LOW | `lib/mock-data.ts` | Mock `confirmed` events have `source: 'local'` — acceptable, guarded | Accepted (dev-only) |
| L1 | NONE | All API routes | Pending events use `source: 'local'` — correct semantics | No action |

---

## 10. Phase 0 Audit Verdict

**The build is clean.** No blocking compile or test failures.

**Phases 1–4 of the ship prompt are largely pre-resolved** by existing implementation. The main work is:
1. Fix three production-reachable dishonesty issues (H1, H2, H3)
2. Add missing env vars to `.env.example` (ENV1)
3. Verify OSKernel owner key (OC1)
4. Update README status table (H4)
5. Perform 3× golden-path clean runs (Phase 3)
6. Write CLAIMS.md, updated README pitch, and DEMO_SCRIPT.md (Phase 4)
7. Compile SUBMISSION.md (Phase 5)

**Recommended next step:** Begin with H2 (fix enforcer addresses) and H3 (zero-address target guard) as they are code fixes that touch the live execution path, then H1 (copy fix), then ENV1 (.env.example), then proceed to Phase 3 golden-path hardening.

---

## 11. Remediation Log

### H2 — FIXED (2026-06-10)

Placeholder enforcer addresses (`0x000…001`–`0x000…006`) removed. Real MetaMask Delegation
Framework enforcer addresses sourced from the framework's official Sepolia deployment broadcasts
(`contracts/lib/delegation-framework/broadcast/DeployCaveatEnforcers.s.sol/11155111/run-1743128284.json`),
NOT typed from memory.

Single source of truth added: `SEPOLIA_ENFORCERS` in `app/src/lib/contracts.ts`;
`templates.ts` now imports it; documented in `CHAINS.md` "SEPOLIA_ENFORCERS" section.
EIP-55 checksums computed via `cast to-check-sum-address`.

On-chain bytecode verification (`cast code <addr> --rpc-url <sepolia>` on 2026-06-10 — all
non-empty, all begin `0x6080604052`):

| Enforcer | Address | code length (hex chars) |
|----------|---------|------------------------|
| ERC20TransferAmountEnforcer | `0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc` | 4158 |
| AllowedMethodsEnforcer | `0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5` | 4090 |
| AllowedTargetsEnforcer | `0x7F20f61b1f09b08D970938F6fa563634d65c4EeB` | 3694 |
| LimitedCallsEnforcer | `0x04658B29F6b82ed55274221a06Fc97D318E25416` | 2516 |
| TimestampEnforcer | `0x1046bb45C8d673d4ea75321280DB34899413c069` | 2512 |
| BlockNumberEnforcer | `0x5d9818dF0AE3f66e9c3D0c5029DAF99d1823ca6c` | 2524 |

Repo-wide grep for `0x000000000000000000000000000000000000000[1-6]`: remaining hits are only
the Venice system-prompt example targets in `intent-parser.ts` (addressed under H3). No other
enforcer placeholder usage exists (`createSubDelegation.ts` / `createSubscriptionDelegation.ts`
take enforcer addresses from the smart-accounts-kit at runtime).

`npx tsc --noEmit` and `pnpm build` clean after change.

### H3 — FIXED (2026-06-10)

Three changes:

1. **Guard** — `assertValidActionTarget()` added to `app/src/lib/delegation/proof-validation.ts`,
   called for every action at the top of `buildAndValidateUserOps()` (which runs first on all four
   execution paths: `/api/execute`, `/api/a2a/execute`, `/api/agents/run`, `/api/registry/publish`).
   Rejects missing, non-hex (unexpanded template tokens), zero-address, and placeholder
   (`0x…0001`–`0x…0006`) targets with `DelegationProofError("action.target is missing or invalid …")`
   → API returns 422. No invalid target can reach the 1Shot submission call.
2. **Parser** — zero-address fallbacks at `intent-parser.ts:181,198` removed; a missing target now
   stays visibly invalid (`'0x'`) and fails validation instead of being submitted to `0x0000…0000`.
3. **Venice prompt** — example targets `0x…0001/0002` replaced with `<TARGET_CONTRACT_ADDRESS>`
   template tokens plus an explicit rule: output a real checksummed address from context or omit
   the action. The guard also rejects the literal token if echoed back.

Evidence — `npx -y tsx scripts/test-target-guard.ts` (all 7 checks pass):
missing target → 422-class error; `0x` → rejected; zero address → rejected; `0x…0001`/`0x…0002`
→ rejected; `<TARGET_CONTRACT_ADDRESS>` → rejected; valid checksummed target (Sepolia USDC) → passes.
`npx tsc --noEmit` and `pnpm build` clean.
