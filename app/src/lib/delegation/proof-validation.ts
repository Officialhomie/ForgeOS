/**
 * Server-side validation before building UserOps / calling 1Shot.
 */

import { slice } from 'viem'
import type { Delegation } from '@/types'
import {
  DelegationProofError,
  resolveProofsForAction,
} from '@/lib/delegation/proof-bundle'
import {
  buildUserOps,
  validateUserOps,
  type UserOp,
} from '@/services/execution-engine/userop-builder'
import type { PlannedAction } from '@/types'
import { getRedeemDelegationsSelector } from '@/lib/delegation/encode-redeem'

/**
 * Addresses that must never be a transaction target: the zero address and the
 * low-numbered placeholder addresses historically used as examples in the
 * Venice system prompt and agent templates.
 */
const FORBIDDEN_TARGETS = new Set<string>(
  Array.from({ length: 7 }, (_, i) => `0x${'0'.repeat(39)}${i}`),
)

/**
 * Reject actions whose target is missing, non-hex (e.g. an unexpanded
 * template token), the zero address, or a known placeholder address.
 * Runs before any UserOp is built, so no invalid target can reach the relay.
 */
export function assertValidActionTarget(action: PlannedAction): void {
  const target = typeof action.target === 'string' ? action.target.toLowerCase() : ''
  if (!/^0x[0-9a-f]{40}$/.test(target) || FORBIDDEN_TARGETS.has(target)) {
    throw new DelegationProofError(
      `action.target is missing or invalid (action "${action.id}", target "${action.target ?? ''}")`,
    )
  }
}

export function buildAndValidateUserOps(opts: {
  actions: PlannedAction[]
  signedDelegations: Delegation[]
  senderAddress?: string
}): UserOp[] {
  if (opts.actions.length === 0) {
    throw new DelegationProofError('actionPlan.actions is empty')
  }

  for (const action of opts.actions) {
    assertValidActionTarget(action)
  }

  for (const action of opts.actions) {
    if (action.delegationChain.length > 0) {
      resolveProofsForAction(action.delegationChain, opts.signedDelegations)
    }
  }

  const userOps = buildUserOps(opts)
  const selector = getRedeemDelegationsSelector()

  const structuralErrors = validateUserOps(userOps)
  if (structuralErrors.length > 0) {
    throw new DelegationProofError(structuralErrors.join('; '))
  }

  for (let i = 0; i < userOps.length; i++) {
    const op = userOps[i]
    if (op.delegationChain.length > 0) {
      const opSelector = slice(op.callData, 0, 4)
      if (opSelector !== selector) {
        throw new DelegationProofError(
          `UserOp[${i}] callData is not redeemDelegations (missing valid proofs)`,
        )
      }
    }
  }

  return userOps
}

export function delegationProofErrorResponse(e: unknown) {
  if (e instanceof DelegationProofError) {
    return {
      success: false as const,
      error: e.message,
      code: e.code,
      missingHash: e.missingHash,
    }
  }
  return null
}
