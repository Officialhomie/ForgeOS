/**
 * Execution Engine — UserOp Builder
 *
 * Converts a PlannedAction (with its delegation chain) into a 1Shot-compatible
 * UserOperation object. Each UserOp includes the delegation proof for that hop.
 */

import type { PlannedAction, Delegation, Hash } from '@/types'
import { encodeRedeemDelegations, getRedeemDelegationsSelector } from '@/lib/delegation/encode-redeem'
import {
  DelegationProofError,
  resolveProofsForAction,
} from '@/lib/delegation/proof-bundle'
import { slice } from 'viem'

export interface UserOp {
  sender?: string
  callData: `0x${string}`
  target: string
  value: string
  nonce: number
  delegationChain: Hash[]
  delegationProofs: Delegation[]
}

export interface BuildUserOpsOptions {
  actions: PlannedAction[]
  signedDelegations: Delegation[]
  senderAddress?: string
}

const allowRawCalldata =
  process.env.ALLOW_RAW_CALLDATA === 'true' ||
  process.env.NEXT_PUBLIC_ALLOW_RAW_CALLDATA === 'true'

export function buildUserOps(opts: BuildUserOpsOptions): UserOp[] {
  const redeemSelector = getRedeemDelegationsSelector()

  return opts.actions.map((action, i) => {
    let proofs: Delegation[] = []
    let callData: `0x${string}`

    if (action.delegationChain.length > 0) {
      proofs = resolveProofsForAction(action.delegationChain, opts.signedDelegations)
      callData = encodeRedeemDelegations(
        proofs,
        action.target,
        action.calldata,
        action.value,
      )
    } else if (allowRawCalldata) {
      callData = action.calldata
    } else {
      throw new DelegationProofError(`UserOp[${i}] has no delegation chain`)
    }

    if (action.delegationChain.length > 0 && slice(callData, 0, 4) !== redeemSelector) {
      throw new DelegationProofError(`UserOp[${i}] failed redeemDelegations encoding`)
    }

    return {
      sender: opts.senderAddress,
      callData,
      target: action.target,
      value: action.value.toString(),
      nonce: i,
      delegationChain: action.delegationChain,
      delegationProofs: proofs,
    }
  })
}

export function validateUserOps(ops: UserOp[]): string[] {
  const errors: string[] = []
  const redeemSelector = getRedeemDelegationsSelector()

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op.delegationChain.length === 0) {
      errors.push(`UserOp[${i}] has no delegation chain`)
      continue
    }
    if (op.delegationProofs.length !== op.delegationChain.length) {
      errors.push(`UserOp[${i}] proof count mismatch`)
    }
    if (slice(op.callData, 0, 4) !== redeemSelector) {
      errors.push(`UserOp[${i}] callData is not redeemDelegations`)
    }
  }
  return errors
}
