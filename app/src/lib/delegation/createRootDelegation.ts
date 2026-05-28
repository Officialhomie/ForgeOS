import {
  createDelegation,
  getSmartAccountsEnvironment,
  ScopeType,
  type Delegation as KitDelegation,
} from '@metamask/smart-accounts-kit'
import {
  createCaveatBuilder,
  hashDelegation,
} from '@metamask/smart-accounts-kit/utils'
import type { Address as ViemAddress } from 'viem'
import { CONTRACTS } from '@/lib/contracts'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import type { Address, Delegation, Hash, Policy } from '@/types'
import { normalizeBytes32 } from '@/lib/delegation/normalize-for-encoding'

function getEnvironment() {
  return Promise.resolve(
    getSmartAccountsEnvironment(ACTIVATION_CHAIN_ID),
  )
}

export async function createRootDelegationStruct(options: {
  delegator: ViemAddress
  delegate?: ViemAddress
  policy?: Partial<Policy>
}): Promise<KitDelegation> {
  const env = await getEnvironment()
  const builder = createCaveatBuilder(env)
  const monthlyCap = options.policy?.monthlySpendCap ?? 500_000_000n
  const expiry =
    options.policy?.expiryTimestamp ??
    Math.floor(Date.now() / 1000) + 30 * 24 * 3600

  const caveats = builder
    .addCaveat('allowedMethods', {
      selectors: ['executeAction(bytes)', 'redelegate(bytes32,bytes)'],
    })
    .addCaveat('erc20TransferAmount', {
      tokenAddress: CONTRACTS.usdc,
      maxAmount: monthlyCap,
    })
    .addCaveat('timestamp', { afterThreshold: 0, beforeThreshold: expiry })
    .build()

  return createDelegation({
    environment: env,
    from: options.delegator,
    to: options.delegate ?? CONTRACTS.osKernel,
    scope: {
      type: ScopeType.Erc20PeriodTransfer,
      tokenAddress: CONTRACTS.usdc,
      periodAmount: monthlyCap,
      periodDuration: 30 * 24 * 3600,
      startDate: Math.floor(Date.now() / 1000),
    },
    caveats,
  })
}

export function kitDelegationToForge(
  kit: KitDelegation,
  signature: `0x${string}` = '0x' as `0x${string}`,
): Delegation {
  const hash = hashDelegation(kit) as Hash
  return {
    hash,
    delegate: kit.delegate as Address,
    delegator: kit.delegator as Address,
    authority: 'ROOT',
    caveats: kit.caveats.map((c) => ({
      enforcer: c.enforcer as Address,
      enforcerName: 'Caveat',
      terms: c.terms,
      decodedTerms: {},
      humanReadable: 'On-chain caveat',
    })),
    salt: normalizeBytes32(kit.salt),
    signature,
    hop: 'root',
    status: 'active',
    issuedAt: Math.floor(Date.now() / 1000),
    lastUsedAt: null,
    agentId: null,
    parentDelegation: null,
    children: [],
  }
}
