/**
 * P8.1 + P8.2 — Sub-delegation and Re-delegation helpers.
 *
 * Hop 1: OSKernel → DeFiAgent   (ERC20TransferAmountEnforcer 500 USDC + AllowedMethodsEnforcer)
 * Hop 2: DeFiAgent → PaymentAgent (ERC20TransferAmountEnforcer 100 USDC + LimitedCallsEnforcer 1)
 *
 * Each hop NARROWS the parent scope — never widens.
 * Sub-delegations carry the parent delegation hash in `authority`.
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

function getEnv() {
  return getSmartAccountsEnvironment(ACTIVATION_CHAIN_SEPOLIA)
}

// ─── HOP 1: OSKernel → DeFiAgent ─────────────────────────────────────────────

/**
 * Creates the OSKernel → DeFiAgent sub-delegation.
 *
 * Narrows from root (1000 USDC) to 500 USDC max per call.
 * Allowed methods: executeAction, redelegate.
 */
export async function createSubDelegationStruct(options: {
  /** OSKernel contract address (delegator) */
  delegator: ViemAddress
  /** DeFiAgent address (delegate) */
  delegate: ViemAddress
  /** Hash of the signed root delegation from user → OSKernel */
  parentDelegationHash: Hash
  /** Max USDC this agent may transfer per call (default 500 USDC = 500_000_000 units) */
  maxUsdcAmount?: bigint
}) {
  const env = getEnv()
  const builder = createCaveatBuilder(env)
  const maxAmount = options.maxUsdcAmount ?? 500_000_000n

  const caveats = builder
    .addCaveat('allowedMethods', {
      selectors: ['executeAction(bytes)', 'redelegate(bytes32,bytes)'],
    })
    .addCaveat('erc20TransferAmount', {
      tokenAddress: CONTRACTS.usdcSepolia,
      maxAmount,
    })
    .build()

  const delegation = createDelegation({
    environment: env,
    from: options.delegator,
    to: options.delegate,
    // authority = parent delegation hash → creates the chain
    authority: options.parentDelegationHash,
    caveats,
  })

  return { delegation, hash: hashDelegation(delegation) as Hash }
}

// ─── HOP 2: DeFiAgent → PaymentAgent ─────────────────────────────────────────

/**
 * Creates the DeFiAgent → PaymentAgent re-delegation (hop 2).
 *
 * Narrows from hop 1 (500 USDC, any calls) to 100 USDC + max 1 call.
 * This is the core A2A mechanic: DeFiAgent delegates payment to PaymentAgent
 * without requiring a new user signature.
 */
export async function createReDelegationStruct(options: {
  /** DeFiAgent address (delegator at this hop) */
  delegator: ViemAddress
  /** PaymentAgent address (delegate at this hop) */
  delegate: ViemAddress
  /** Hash of the signed hop-1 sub-delegation (OSKernel → DeFiAgent) */
  parentDelegationHash: Hash
  /** Max USDC this re-delegation may transfer (default 100 USDC = 100_000_000 units) */
  maxUsdcAmount?: bigint
  /** Max calls allowed (default 1 for a single A2A execution) */
  maxCalls?: number
}) {
  const env = getEnv()
  const builder = createCaveatBuilder(env)
  const maxAmount = options.maxUsdcAmount ?? 100_000_000n
  const limit = options.maxCalls ?? 1

  const caveats = builder
    .addCaveat('erc20TransferAmount', {
      tokenAddress: CONTRACTS.usdcSepolia,
      maxAmount,
    })
    .addCaveat('limitedCalls', { limit })
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

// ─── CONVERSION HELPER ────────────────────────────────────────────────────────

export function subDelegationToForge(
  kitDel: ReturnType<typeof createDelegation>,
  hash: Hash,
  hop: 'sub' | 'redelegation',
  agentId: string | null = null,
  parentDelegationHash: Hash | null = null,
  signature: `0x${string}` = '0x' as `0x${string}`,
): Delegation {
  return {
    hash,
    delegate: kitDel.delegate as Address,
    delegator: kitDel.delegator as Address,
    authority: (kitDel.authority ?? parentDelegationHash ?? 'ROOT') as Hash | 'ROOT',
    caveats: kitDel.caveats.map((c) => ({
      enforcer: c.enforcer as Address,
      enforcerName: 'Caveat',
      terms: c.terms,
      decodedTerms: {},
      humanReadable: 'On-chain caveat',
    })),
    salt: kitDel.salt,
    signature,
    hop,
    status: 'active',
    issuedAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    agentId,
    parentDelegation: null,
    children: [],
  }
}
