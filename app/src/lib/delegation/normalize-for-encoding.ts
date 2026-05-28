import { padHex, type Hex } from 'viem'
import type { Delegation, Hash } from '@/types'

export const ROOT_AUTHORITY_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

/**
 * MetaMask kit defaults salt to `0x00` (1 byte). On-chain + viem ABI expect bytes32.
 */
export function normalizeBytes32(value: Hex | string | undefined | null): Hex {
  if (!value || value === '0x') {
    return ROOT_AUTHORITY_BYTES32
  }
  return padHex(value as Hex, { size: 32 })
}

export function normalizeAuthority(authority: Hash | 'ROOT'): Hex {
  return authority === 'ROOT' ? ROOT_AUTHORITY_BYTES32 : normalizeBytes32(authority)
}

/** Delegation tuple shape for OSKernel.redelegate / DeleGatorCore encoding. */
export function delegationTupleForEncoding(d: Delegation) {
  return {
    delegate: d.delegate,
    delegator: d.delegator,
    authority: normalizeAuthority(d.authority),
    caveats: d.caveats.map((c) => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: '0x' as Hex,
    })),
    salt: normalizeBytes32(d.salt),
    signature: d.signature && d.signature !== '0x' ? d.signature : ('0x' as Hex),
  }
}
