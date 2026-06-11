# CLAIMS.md — What ForgeOS Claims, and What It Does Not

Every sentence in the demo, README, video, and submission must trace to one of the
TRUE claims below. CONDITIONAL claims are locked until their evidence exists.
FORBIDDEN phrasings must never appear. Evidence references are in `SHIP_AUDIT.md`.

---

## TRUE — always safe to claim

1. **Creation-time narrowing is enforced on-chain.** `OSKernel.redelegate()` on Sepolia
   (`0xa4bD3e0946431dFA0C38F700f5935E03b749C77C`) validates that every sub-delegation is a
   strict narrowing of its parent and reverts `CaveatWideningNotAllowed` otherwise.
   Verified in 12/12 Foundry tests and against deployed Sepolia bytecode on a fork;
   live revert tx hash captured via `contracts/script/FirewallMoment.s.sol`
   (hash recorded in SHIP_AUDIT.md once broadcast).
2. **A 2-hop narrowing capability chain is implemented and deployed.** Root (user-scoped) →
   DeFiAgent (500 USDC cap) → PaymentAgent (100 USDC cap + 1-call limit). Each hop is created
   without a new user signature and can only shrink the parent's scope.
3. **Venice AI inference is live with real x402 USDC payments on Base mainnet.** Intent
   parsing in the main loop is paid per-call from the agent wallet; Venice retains nothing.
4. **The 1Shot relay integration is real and webhook-driven.** Submissions go through
   `relayer_send7710Transaction`; confirmations arrive via Ed25519-signature-verified
   webhooks, stream to the UI over SSE, and every activity event carries its `source`
   (`local` while pending, `webhook` once confirmed). No polling.
5. **Treasury-level spend bounds are enforced on-chain at execution time.** `AgentTreasury`
   (`0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429`) checks `isDelegationActive`, per-agent
   budget, and per-user balance before any spend. These are treasury-level runtime checks —
   distinct from caveat-enforcer enforcement, and described as such.
6. **The kill switch is real.** `OSKernel.revokeAll()` is `onlyOwner`; the on-chain owner is
   verified to be the team's deployer wallet, and the owner-check simulation passes (reverts
   `OwnableUnauthorizedAccount` for anyone else).
7. **Delegation caveats reference real, verified enforcer contracts.** All six enforcer
   addresses in agent templates are the MetaMask Delegation Framework's official Sepolia
   deployments, each verified to have on-chain bytecode (`CHAINS.md` SEPOLIA_ENFORCERS).
8. **The delegation lifecycle is indexed.** A subgraph maps grants/revocations from on-chain
   events (deployment currently being re-published — UI falls back to RPC log scan).
9. **The UI refuses to lie.** No state shows Confirmed/Succeeded/Installed without a webhook,
   RPC receipt, or subgraph event behind it. Failure paths return typed errors (422 for
   invalid targets or missing proofs), verified over HTTP.

## CONDITIONAL — locked until evidence exists

- **"Caveats are enforced on-chain at execution time via redeemDelegations."**
  Status: NOT YET CLAIMABLE. The 2026-06-10 probe proved the 1Shot relayer performs the
  ERC-7710 redemption itself from the supplied delegation chain (and the app's relay encoding
  was fixed accordingly), but no successful on-chain redemption trace exists yet. This claim
  unlocks ONLY when both of these tx hashes are recorded in SHIP_AUDIT.md:
  1. a successful golden-path execution whose Sepolia trace shows `redeemDelegations` and
     enforcer calls, and
  2. a cap-exceeding execution that reverts on-chain at the `ERC20TransferAmountEnforcer`.
  Until then, say: "spend bounds are enforced on-chain by the treasury, and delegation scope
  is enforced on-chain at creation time; execution-time caveat redemption goes through the
  1Shot relayer's ERC-7710 redemption flow."

## FORBIDDEN — must never appear (grep-verified absent from user-facing surfaces)

- **"zero-knowledge" / "ZK"** in any form. Venice zero-retention is a privacy policy, not a
  cryptographic ZK guarantee. Say "zero-retention AI" / "cryptographically scoped permissions".
- **"Agents negotiate / reason together."** Say: "a narrowing capability chain" — hop 2 is
  derived authority, not negotiation.
- **Any mainnet implication.** State plainly, once: contracts and ERC-7715 run on Ethereum
  Sepolia; the only mainnet component is x402 USDC payment on Base.
- **Presenting OSKernel as the production MetaMask DelegationManager.** Honest line:
  "implements the ERC-7710 delegation lifecycle with on-chain narrowing validation for this
  demo, designed to pair with MetaMask's EIP7702DeleGatorCore in production."
- **Describing any `source: 'local'` event as a chain confirmation.** Pending means pending.
- **Describing demo-mode data as live.** Demo mode shows a banner and is hard-blocked from
  hydrating mock data in production builds.
