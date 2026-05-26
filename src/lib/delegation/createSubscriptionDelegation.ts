/**
 * P9.1 — Subscription delegation builder.
 *
 * Creates the ERC-7710 delegation that acts as an x402 subscription policy.
 * Three caveats lock the scope to a recurring payment pattern:
 *
 *   TimestampEnforcer       — valid window (now → now + durationSeconds)
 *   ERC20TransferAmountEnforcer — max USDC per single execution
 *   LimitedCallsEnforcer    — max total executions over the window
 *
 * No new user signature is required per cycle — the delegation proof IS
 * the subscription. This is the core of the Best x402 + ERC-7710 track.
 */

import {
  createDelegation,
  getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit'
import {
  createCaveatBuilder,
  hashDelegation,
} from '@metamask/smart-accounts-kit/utils'
import type { Address as ViemAddress } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { ACTIVATION_CHAIN_SEPOLIA } from '@/types/activation'
import type { Address, Delegation, Hash } from '@/types'

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

/** 30 days in seconds */
const DEFAULT_DURATION_SECONDS = 30 * 24 * 60 * 60

/** 10 USDC (6 decimals) */
const DEFAULT_MAX_AMOUNT_PER_CYCLE = 10_000_000n

/** 30 cycles over the window (one per day for a month) */
const DEFAULT_MAX_CYCLES = 30

// ─── OPTION TYPES ─────────────────────────────────────────────────────────────

export interface SubscriptionDelegationOptions {
  /** OSKernel contract (delegator — root of the chain) */
  delegator: ViemAddress
  /** PaymentAgent address (delegate — executes x402 payments) */
  delegate: ViemAddress
  /** Hash of the signed root delegation (user → OSKernel) */
  parentDelegationHash: Hash
  /** Subscription window in seconds (default 30 days) */
  durationSeconds?: number
  /** Max USDC transferable per cycle (default 10 USDC = 10_000_000 units) */
  maxAmountPerCycle?: bigint
  /** Max number of payment cycles allowed (default 30) */
  maxCycles?: number
}

// ─── MAIN FUNCTION ────────────────────────────────────────────────────────────

/**
 * Build a subscription delegation with the 3-caveat policy set.
 *
 * The delegation is NOT signed here — call signDelegation() from
 * @metamask/smart-accounts-kit before submitting to 1Shot.
 */
export async function createSubscriptionDelegation(
  options: SubscriptionDelegationOptions,
): Promise<{ delegation: ReturnType<typeof createDelegation>; hash: Hash }> {
  const env = getSmartAccountsEnvironment(ACTIVATION_CHAIN_SEPOLIA)
  const builder = createCaveatBuilder(env)

  const durationSeconds = options.durationSeconds ?? DEFAULT_DURATION_SECONDS
  const maxAmount = options.maxAmountPerCycle ?? DEFAULT_MAX_AMOUNT_PER_CYCLE
  const maxCycles = options.maxCycles ?? DEFAULT_MAX_CYCLES

  const now = Math.floor(Date.now() / 1000)
  const validAfter = now
  const validBefore = now + durationSeconds

  const caveats = builder
    // Enforces the time window — no payments outside validAfter..validBefore
    .addCaveat('timestamp', { validAfter, validBefore })
    // Caps each x402 payment to maxAmountPerCycle
    .addCaveat('erc20TransferAmount', {
      tokenAddress: CONTRACTS.usdcSepolia,
      maxAmount,
    })
    // Caps total executions — prevents runaway spending if compromised
    .addCaveat('limitedCalls', { limit: maxCycles })
    .build()

  const delegation = createDelegation({
    environment: env,
    from: options.delegator,
    to: options.delegate,
    authority: options.parentDelegationHash,
    caveats,
  })

  return { delegation, hash: hashDelegation(delegation) as Hash }
}

// ─── FORGE TYPE CONVERSION ────────────────────────────────────────────────────

/**
 * Converts a subscription delegation (from @metamask/smart-accounts-kit) into
 * the ForgeOS Delegation shape used by the UI and stores.
 */
export function subscriptionDelegationToForge(
  kitDel: ReturnType<typeof createDelegation>,
  hash: Hash,
  agentId: string,
  validAfter: number,
  validBefore: number,
  maxAmount: bigint,
  maxCycles: number,
  signature: `0x${string}` = '0x' as `0x${string}`,
): Delegation {
  return {
    hash,
    delegate: kitDel.delegate as Address,
    delegator: kitDel.delegator as Address,
    authority: (kitDel.authority ?? 'ROOT') as Hash | 'ROOT',
    caveats: [
      {
        enforcer: kitDel.caveats[0]?.enforcer as Address ?? '0x' as Address,
        enforcerName: 'TimestampEnforcer',
        terms: kitDel.caveats[0]?.terms ?? '0x',
        decodedTerms: { validAfter, validBefore },
        humanReadable: `Valid ${new Date(validAfter * 1000).toLocaleDateString()} – ${new Date(validBefore * 1000).toLocaleDateString()}`,
      },
      {
        enforcer: kitDel.caveats[1]?.enforcer as Address ?? '0x' as Address,
        enforcerName: 'ERC20TransferAmountEnforcer',
        terms: kitDel.caveats[1]?.terms ?? '0x',
        decodedTerms: { maxAmount: maxAmount.toString(), token: CONTRACTS.usdcSepolia },
        humanReadable: `Max ${Number(maxAmount) / 1_000_000} USDC per payment`,
      },
      {
        enforcer: kitDel.caveats[2]?.enforcer as Address ?? '0x' as Address,
        enforcerName: 'LimitedCallsEnforcer',
        terms: kitDel.caveats[2]?.terms ?? '0x',
        decodedTerms: { limit: maxCycles },
        humanReadable: `Max ${maxCycles} payments`,
      },
    ],
    salt: kitDel.salt,
    signature,
    hop: 'sub',
    status: 'active',
    issuedAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    agentId,
    parentDelegation: null,
    children: [],
  }
}
