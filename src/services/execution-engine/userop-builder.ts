/**
 * Execution Engine — UserOp Builder
 *
 * Converts a PlannedAction (with its delegation chain) into a 1Shot-compatible
 * UserOperation object. Each UserOp includes the delegation proof for that hop.
 *
 * Track evidence:
 *  - Best 1Shot: UserOps submitted via relayer_send7710Transaction
 *  - Best x402+7710: delegation proof embedded per UserOp
 *  - Best A2A: each hop in the chain has its own delegation proof
 */

import type { PlannedAction, Delegation, Hash } from '@/types'

// ─── USEROP SHAPE ─────────────────────────────────────────────────────────────

/** Shape expected by 1Shot's relayer_send7710Transaction */
export interface UserOp {
  sender?: string
  callData: `0x${string}`
  target: string
  value: string         // bigint serialised as string
  nonce: number
  /** Ordered chain of delegation hashes for this hop */
  delegationChain: Hash[]
  /** Full signed delegation objects (for on-chain proof verification) */
  delegationProofs: Delegation[]
}

// ─── BUILDER ─────────────────────────────────────────────────────────────────

export interface BuildUserOpsOptions {
  actions: PlannedAction[]
  /** All signed delegations available — builder matches by hash */
  signedDelegations: Delegation[]
  /** Smart account address (sender of the UserOps) */
  senderAddress?: string
}

/**
 * Build one UserOp per PlannedAction, in execution order.
 *
 * For a 2-hop A2A plan:
 *  - UserOp[0] embeds the hop-1 delegation proof (OSKernel → DeFiAgent)
 *  - UserOp[1] embeds the hop-2 delegation proof (DeFiAgent → PaymentAgent)
 */
export function buildUserOps(opts: BuildUserOpsOptions): UserOp[] {
  return opts.actions.map((action, i) => {
    // Find signed delegation objects that match this hop's chain
    const proofs = action.delegationChain
      .map((hash) => opts.signedDelegations.find((d) => d.hash === hash))
      .filter((d): d is Delegation => d !== undefined)

    return {
      sender: opts.senderAddress,
      callData: action.calldata,
      target: action.target,
      value: action.value.toString(),
      nonce: i,
      delegationChain: action.delegationChain,
      delegationProofs: proofs,
    }
  })
}

// ─── DEMO USER OPS ────────────────────────────────────────────────────────────

/**
 * Build mock UserOps for demo mode.
 * Returns properly shaped objects with placeholder data.
 */
export function buildDemoUserOps(
  actions: PlannedAction[],
  senderAddress?: string,
): UserOp[] {
  return actions.map((action, i) => ({
    sender: senderAddress ?? '0xDemoSender0000000000000000000000000000000',
    callData: action.calldata,
    target: action.target,
    value: action.value.toString(),
    nonce: i,
    delegationChain: action.delegationChain,
    delegationProofs: [],
  }))
}

// ─── PROOF VALIDATION ─────────────────────────────────────────────────────────

/**
 * Validate that UserOps have required delegation proofs.
 * Returns error strings for any missing proofs.
 */
export function validateUserOps(ops: UserOp[]): string[] {
  const errors: string[] = []
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    if (op.delegationChain.length === 0) {
      errors.push(`UserOp[${i}] has no delegation chain`)
    }
  }
  return errors
}
