/**
 * Delegation proof bundle helpers for redeemDelegations UserOp encoding.
 */

import type { Delegation, Hash } from '@/types'

/** Placeholder signatures that must not be sent to 1Shot. */
const PLACEHOLDER_SIGNATURES = new Set([
  '0x',
  `0x${'00'.repeat(65)}`,
  `0x${'00'.repeat(64)}`,
])

/** Marker set after on-chain OSKernel.redelegate confirms (Phase 2). */
export const ONCHAIN_DELEGATION_MARKER = `0x${'ab'.repeat(32)}` as const

export class DelegationProofError extends Error {
  constructor(
    message: string,
    public readonly code: 'DELEGATION_PROOF_MISSING' = 'DELEGATION_PROOF_MISSING',
    public readonly missingHash?: Hash,
  ) {
    super(message)
    this.name = 'DelegationProofError'
  }
}

export function isValidProof(d: Delegation): boolean {
  const sig = d.signature?.toLowerCase() ?? '0x'
  if (!sig || sig === '0x') return false
  if (PLACEHOLDER_SIGNATURES.has(sig)) return false
  if (sig === ONCHAIN_DELEGATION_MARKER.toLowerCase()) return true
  return /^0x[0-9a-f]{130}$/i.test(sig)
}

/**
 * Ordered chain for redeem encoding: root → sub → re (most permissive first).
 */
export function getDelegationBundle(
  root: Delegation | null,
  sub: Delegation | null,
  re: Delegation | null,
): Delegation[] {
  return [root, sub, re].filter((d): d is Delegation => d !== null)
}

export function findProofForHash(
  hash: Hash,
  signedDelegations: Delegation[],
): Delegation | undefined {
  return signedDelegations.find((d) => d.hash.toLowerCase() === hash.toLowerCase())
}

/**
 * Resolve proofs for one action's delegationChain; throws if any hash lacks valid proof.
 */
export function resolveProofsForAction(
  delegationChain: Hash[],
  signedDelegations: Delegation[],
): Delegation[] {
  const proofs: Delegation[] = []
  for (const hash of delegationChain) {
    const proof = findProofForHash(hash, signedDelegations)
    if (!proof) {
      throw new DelegationProofError(
        `Missing delegation proof for hash ${hash}`,
        'DELEGATION_PROOF_MISSING',
        hash,
      )
    }
    if (!isValidProof(proof)) {
      throw new DelegationProofError(
        `Invalid or unsigned delegation proof for hash ${hash}`,
        'DELEGATION_PROOF_MISSING',
        hash,
      )
    }
    proofs.push(proof)
  }
  return proofs
}

export function validateBundleForA2A(
  root: Delegation | null,
  sub: Delegation | null,
  re: Delegation | null,
): string[] {
  const errors: string[] = []
  if (!root) errors.push('root delegation missing')
  else if (!isValidProof(root)) errors.push('root delegation unsigned')
  if (!sub) errors.push('sub delegation missing')
  else if (!isValidProof(sub)) errors.push('sub delegation unsigned')
  if (!re) errors.push('re-delegation missing')
  else if (!isValidProof(re)) errors.push('re-delegation unsigned')
  return errors
}
