# ForgeOS User Guide

Everything a user needs to know — from first login to running a full autonomous agent network.

---

## What is ForgeOS?

ForgeOS is an AI agent operating system built on blockchain. It lets you give AI agents
permission to act on your behalf — move funds, execute payments, rebalance portfolios —
without ever handing over your wallet.

The core idea: **you set rules once, your agents work forever within those rules**.

Every permission is a cryptographic delegation on-chain. Agents cannot do anything
you have not explicitly allowed. You can revoke everything in one tap at any time.

---

## Part 1: End-to-End User Flow

### Step 1: Activate Your OS (first time only)

1. Open ForgeOS and click **Activate**
2. Connect your MetaMask wallet
3. ForgeOS deploys a **Smart Account** at a new address — this is your agent hub
4. You sign **one EIP-7715 permission** in MetaMask — this is the root delegation that powers all future agent activity
5. Deposit USDC into your treasury — this is the spending budget your agents draw from

That is it. One signature unlocks the entire platform.

**What gets created behind the scenes:**
- Root delegation: Your wallet → OSKernel (the protocol's router)
- Sub-delegation (auto): OSKernel → DeFiAgent (capped at 500 USDC per action)
- Re-delegation (auto): DeFiAgent → PaymentAgent (capped at 100 USDC, 1 call max)

You never see this chain being built. It self-assembles after your single approval.

---

### Step 2: Explore Your Dashboard

Once activated, your dashboard has 7 sections:

| Section | What it shows |
|---------|--------------|
| Overview | Live activity feed, system status, quick stats |
| Agents | All agents you have installed or built |
| Permissions | The full delegation chain — who can do what |
| Spending | Your USDC balance, payment history, earnings split |
| Auto-payments | Recurring payment schedules |
| Builder | No-code agent creation |
| Marketplace | Community-published agents to install |

---

### Step 3: Run Your First Command

Press **Cmd+K** (or Ctrl+K on Windows) from anywhere in the dashboard.

Type what you want in plain English:
- `check my portfolio balance`
- `send 5 USDC to 0x1234...`
- `show me what my agents did today`

ForgeOS sends your request to Venice AI, which builds an **ActionPlan** — a list of
on-chain steps with an estimated cost. You review the plan and click **Execute**.

The plan is submitted via 1Shot relay (gasless). A webhook confirms when the chain
settles. You see the result in your activity feed.

**Nothing executes without your explicit approval at this stage.** The AI proposes,
you decide.

---

### Step 4: Install an Agent from the Marketplace

1. Navigate to `/marketplace`
2. Browse agents by category (DeFi, Payments, NFTs, Social, Data)
3. Click any agent to see its rules — every enforcer is listed before you install
4. Click **Add to my account** — MetaMask shows exactly what permission you are granting
5. Approve — the agent appears in your Agents dashboard

The agent can now run on its schedule. You never sign again unless you update its rules.

---

### Step 5: Build Your Own Agent

1. Navigate to **Builder** (`/dashboard/builder`)
2. Pick a template that matches what you want to do
3. Fill in the config form — no code required
4. Check the **Caveat Preview** on the right — this shows the hard limits that will
   be enforced on-chain (max spend, allowed methods, run frequency)
5. Click **Try it out** — Venice runs a simulation and shows you what the agent would do
6. Click **Grant access** — your wallet signs the delegation
7. Click **Launch agent** — it goes live and gets an IPFS profile URI

The agent runs on the schedule you set. You can pause or revoke it at any time from
the Permissions page.

---

### Step 6: Set Up Recurring Payments

1. Navigate to **Auto-payments** (`/dashboard/subscriptions`)
2. Click **+ Set up a new one**
3. Fill in: name, recipient address, amount, frequency, how many times
4. Submit — a delegation is created with a `TimestampEnforcer` and an `ERC20TransferAmountEnforcer`

Your agent executes payments on schedule without any further involvement from you.
If you need to stop early, click **Cancel** — the delegation is revoked on-chain immediately.

---

### Step 7: Monitor Your Treasury

Navigate to **Spending** (`/dashboard/treasury`):

- **Available balance**: Your USDC, live from the chain
- **Donut chart**: Available vs Spent vs Reserved at a glance
- **Bar chart**: 30-day daily spend history (from the subgraph)
- **Recent payments**: Every payment your agents made, with timestamps and amounts
- **Earnings split**: 80% you, 15% refill pool, 5% platform fee

To add funds, click **Add funds** — USDC is deposited gaslessly via 1Shot.
To withdraw your balance back to your wallet, use the withdraw function (no sign-in required,
just your wallet signature on the withdrawal transaction).

---

### Step 8: Manage Permissions

Navigate to **Permissions** (`/dashboard/delegations`):

- **Delegation tree**: Visual map of the full chain from your wallet down to each agent
- **Active permissions**: List of every live delegation with caveat details
- **Revoke a single agent**: Click Revoke on any card — surgical removal
- **Export backup**: Downloads your full delegation bundle as a JSON proof file
- **Kill Switch** (top bar): Revokes ALL delegations instantly — emergency use

Check this page whenever you want to audit what your agents can actually do.

---

## Part 2: What Agents Can Do

### Agent Types

| Agent | What It Does | Run Interval |
|-------|-------------|-------------|
| DeFi Rebalancer | Monitors portfolio drift, executes swaps to hit your target allocation | Every hour |
| Payment Executor | Sends USDC to a list of recipients on a schedule | Every day |
| NFT Lifeguard | Monitors floor prices, lists/delists your NFTs to protect value | Every 30 min |
| Social Poster | Posts on-chain portfolio events to Lens or Farcaster | Every 6 hours |
| Data Broker | Collects analytics, generates embeddings, optionally sells insights | Every 12 hours |

### What Agents Cannot Do (by design)

- Spend more USDC than the caveat cap per action (enforced by `ERC20TransferAmountEnforcer`)
- Call methods you have not whitelisted (enforced by `AllowedMethodsEnforcer`)
- Interact with contracts you have not approved (enforced by `AllowedTargetsEnforcer`)
- Exceed their usage limit (enforced by `LimitedCallsEnforcer`)
- Act outside a date/time window (enforced by `TimestampEnforcer`)
- Widen their own permissions — sub-delegations can only narrow scope, never expand it

These are not policy rules in a database. They are Solidity enforcer contracts on-chain.
Even the protocol operator cannot override them.

---

## Part 3: Tips for Building Effective Agents

### Tip 1: Start With a Tight Spend Cap

When you first build an agent, set the spend cap low — $10-50 USDC.
Let it run for a few cycles. Review the Permissions page and Spending page.
If it behaves correctly, raise the cap. Build trust incrementally.

### Tip 2: Use the "Try It Out" Button Before Launching

The **Try it out** button runs Venice AI against your config and shows you a simulated
action plan. It costs nothing. Use it to verify the agent will behave as expected before
you sign anything.

### Tip 3: Write Specific Prompts

Vague prompts produce unpredictable agents. Good prompt pattern:

```
You are a [role]. Your goal is [specific outcome].
Only act when [condition]. Never [hard constraint].
Always [safety rule]. Max: [limit].
```

Example — DeFi Rebalancer:
```
You are a portfolio rebalancer. Your goal is to maintain BTC 50%, ETH 30%, USDC 20%.
Only rebalance when any asset drifts more than 5% from target.
Never swap more than 500 USDC in a single transaction.
Always check slippage before submitting. Max slippage: 1%.
```

### Tip 4: Layer Multiple Caveats

One caveat is not enough for high-stakes agents. Stack them:

- Spend cap: limits the dollar amount
- Allowed methods: limits which functions the agent can call
- Limited calls: limits how many times it runs per activation
- Timestamp: limits the window it can operate in (e.g., only business hours)

The more caveats, the smaller the attack surface if something goes wrong.

### Tip 5: Use the Delegation Tree to Audit

After launching an agent, go to Permissions and expand its delegation card.
Verify the enforcer addresses match what you configured in the builder.
If anything looks wrong, revoke immediately and rebuild.

### Tip 6: Set Agent Budgets in the Treasury

Beyond per-call spend caps (enforced by caveats), you can set an agent's lifetime budget
via `AgentTreasury.setAgentBudget()`. This is a second layer — even if each call is within
the caveat limit, the agent stops when it hits the total budget.

Useful for: project-based agents (e.g., run until $200 is spent on this campaign).

### Tip 7: Subscription Agents vs Scheduled Agents

Use **subscriptions** for fixed recurring payments to a known address (e.g., salary, rent, DCA).
Use **scheduled agents** for dynamic logic that computes what to do at runtime (e.g., rebalancing).

Subscriptions are simpler and have a clear payment history.
Agents are more powerful but require more careful prompt engineering.

### Tip 8: Build for Failure

Assume the AI will occasionally misinterpret an intent. Your caveats are your safety net.
Design them to make the worst-case outcome acceptable, not just the expected case.

Ask: "If this agent went completely off-script, what is the worst it could do within
the current caveat constraints?" If the answer is acceptable, deploy. If not, tighten the caveats.

### Tip 9: Export Your Proof Bundle Before Revoking

Before revoking any delegation, export your proof bundle (Permissions → Download backup).
This JSON file is a cryptographic record of what was authorized. Useful for auditing,
disputes, or reconstructing the chain later.

### Tip 10: Use the Kill Switch Sparingly

The Kill Switch (`revokeAll`) is useful in emergencies but it revokes everything —
including subscriptions and agents you want to keep. After triggering it, you need
to re-create all your delegations from scratch. Prefer `revokeOne` for targeted removal.

---

## Part 4: Understanding Your Treasury

### How Balances Work

Your USDC balance is tracked per-user in the `AgentTreasury` contract:

```
userBalance[your_address] = how much USDC you have deposited and not yet spent
```

When an agent executes a payment, it debits your personal balance — not a shared pool.
When you withdraw, you get exactly your balance back to your wallet.

### The 80/15/5 Split

Every payment your agent makes is split:
- **80%** goes to the payee (the service or recipient)
- **15%** goes to a refill pool (used to top up your balance automatically over time)
- **5%** goes to the platform

This means if your agent pays $10, the recipient gets $8, $1.50 feeds back to the refill
pool (which eventually top up your balance), and $0.50 goes to the platform.

### Withdrawing Your Balance

You can withdraw your remaining USDC balance at any time. The withdrawal sends exactly
`userBalance[your_address]` back to your wallet. No fees on withdrawals.

---

## Part 5: Common Questions

**Q: Do agents have access to my main wallet?**
No. Agents operate through the OSKernel smart account via delegations. Your main wallet
private key never touches the agent system.

**Q: What happens if Venice AI is down?**
The command bar will return an error. No transactions are submitted. Your funds are safe.
Check `/dashboard/status` to see the service health.

**Q: Can I run multiple agents at the same time?**
Yes. Each agent has its own delegation, its own spend cap, and its own run schedule.
They operate independently.

**Q: What if an agent runs out of my treasury balance?**
The `executePayment` call reverts with `InsufficientUserBalance`. The agent does nothing.
Top up your balance and it will resume on the next scheduled run.

**Q: Can the protocol take my USDC?**
`executePayment` is `onlyOwner`, meaning only the protocol can call it. However, it can
only debit your balance when a valid delegation proof exists (verified via `OSKernel.isDelegationActive`).
If you revoke your delegations, no payments can be executed — the proof check will fail.

**Q: Can I have multiple users sharing one treasury?**
Not with the current contract. Each wallet address has its own isolated balance.
For team setups, each team member activates their own OS instance.

**Q: How do I know my spend caps are actually enforced?**
The enforcer contracts are deployed on-chain and their addresses are part of the delegation
hash. The hash is verified before any execution. You can inspect the enforcer addresses on
the Permissions page and cross-reference them with the MetaMask delegation framework docs.
