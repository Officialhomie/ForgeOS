# DEMO_SCRIPT.md — ForgeOS Golden Path

Target length: ~4 minutes. Every claim spoken here maps to `CLAIMS.md`.
Pending states are narrated as a feature, never apologized for.

## Pre-flight (before recording / judging)

1. `app/.env.local` complete — `/dashboard/status` fully green (includes presence checks for
   `FORGE_OWNER_KEY`, `CRON_SECRET`, `FORGE_SMART_ACCOUNT_ADDRESS`, agent addresses).
2. Balances: AgentTreasury ≥ 10 USDC (Sepolia), x402 wallet ≥ 2 USDC (Base).
3. Clean browser profile: cleared localStorage, MetaMask Flask on Sepolia, demo account
   `0xF34C…6D1` connected. `NEXT_PUBLIC_DEMO_MODE` unset.
4. Etherscan tabs pre-opened (record actual hashes in SHIP_AUDIT.md after the firewall script
   and golden-path runs produce them):
   - OSKernel `0xa4bD3e0946431dFA0C38F700f5935E03b749C77C`
   - AgentTreasury `0x95B93bF1Ed959dfb1BBEC6Af023A3263740BC429`
   - FirewallMoment widening-revert tx (the FAILED tx — this is the money shot)
   - FirewallMoment narrowing-accept tx
   - Golden-path execution tx from a prior clean run

## Step 1 — Activation (ERC-7715 scoped approval)

**Do:** Land on `/`, click Activate, walk the 4-step wizard, approve in MetaMask Flask.

**Say:** "I'm granting ForgeOS one permission — scoped, capped, and expiring. This ERC-7715
approval in MetaMask Flask is the only signature I will ever give. Everything agents do from
here is derived authority, never my keys."

**Expect:** Wizard completes; root delegation appears with its caveats listed (spend cap,
allowed methods, expiry). Status shows the activation as confirmed only after the relay
webhook / receipt lands — if it shows "Pending — awaiting webhook" for a few seconds, point
at it: "the UI refuses to claim success until the chain confirms."

## Step 2 — The delegation tree and the firewall moment

**Do:** Open `/dashboard/delegations`. Show the 2-hop tree. Then show the pre-opened
Etherscan tab with the widening-revert transaction.

**Say:** "Authority narrows at every hop: my account granted 500 USDC of scope to the DeFi
agent; it re-delegated 100 USDC and a single call to the payment agent — no new signature
from me. And this is not a UI rule: here is a real Sepolia transaction that tried to widen
a sub-delegation to 1000 USDC. The kernel reverted it on-chain: `CaveatWideningNotAllowed —
amount exceeds parent`. That's the firewall."

**Expect:** Tree renders both hops with caveats; Etherscan shows the failed tx with the
revert reason and the succeeded narrowing tx next to it.

## Step 3 — Live Venice x402 inference

**Do:** Open the command bar, type a natural-language intent
(e.g. "pay 5 USDC to the payment agent's recipient list").

**Say:** "The intent goes to Venice AI — zero-retention inference, and the agent pays for
the call itself: a real USDC micropayment on Base over x402. The model returns a structured
plan; anything malformed — a missing or zero target address — is rejected server-side with
a 422 before any transaction exists."

**Expect:** Plan preview renders with hop assignments and amounts within caveat limits.

## Step 4 — Gasless execution via 1Shot, webhook-confirmed

**Do:** Approve the plan. Watch the activity feed.

**Say:** "Execution is gasless: the delegation chain itself is the authorization. 1Shot
redeems it through the MetaMask delegation framework and relays the transaction. Notice the
state: Submitted, source 'local' — the UI will not say Confirmed until 1Shot's
Ed25519-signed webhook delivers the transaction hash."

**Expect:** Pending → Confirmed transition with a real txHash linked to Etherscan;
`source` flips to `webhook`. (Deliberate pending window = feature, narrate it.)

## Step 5 — A2A 2-hop chain execution

**Do:** Trigger an intent that requires both hops (DeFi decision → payment execution).

**Say:** "Two agents, one chain of authority. The DeFi agent decides; the payment agent
executes — but only inside the 100-USDC, single-call scope it was re-delegated. The second
hop is derived authority, not negotiation."

**Expect:** Both hops appear in the feed, each carrying its own delegation chain; hop 2
confirms with its own webhook-delivered txHash.

## Step 6 — Kill switch

**Do:** Click the red Kill Switch in the topbar. Confirm.

**Say:** "One transaction, owner-signed, revokes the entire tree on-chain — every
delegation, every hop, every agent. Here's the `revokeAll` receipt."

**Expect:** All delegations flip to revoked after the receipt lands; agents stop; the
Etherscan receipt shows `AllDelegationsRevoked`.

## Close

**Say:** "ForgeOS: give an agent the authority to act — not the keys to everything.
Scoped on the way in, narrowed at every hop, revocable in one transaction, and a UI that
never claims more than the chain confirms."

---

## Failure honesty (if anything breaks live)

- Relay down → the feed shows the typed failure (RELAY_UNAVAILABLE-style), never success.
  Narrate: "and this is what honesty looks like when a dependency fails."
- Webhook slow → state stays "Pending — awaiting webhook". Narrate as the feature it is.
- Never refresh-and-pray: the state machine is the demo.
