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

export function buildAndValidateUserOps(opts: {
  actions: PlannedAction[]
  signedDelegations: Delegation[]
  senderAddress?: string
}): UserOp[] {
  if (opts.actions.length === 0) {
    throw new DelegationProofError('actionPlan.actions is empty')
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
