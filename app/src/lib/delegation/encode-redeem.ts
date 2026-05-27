/**
 * encode-redeem.ts
 *
 * Encodes redeemDelegations() calldata for DeleGatorCore.
 *
 * This is Phase 1 of IMPL.md. Every UserOp submitted to 1Shot must have
 * callData = redeemDelegations(permissionContexts, modes, executionCallDatas)
 * so that the MetaMask Delegation Framework enforces caveats on-chain.
 *
 * Track evidence:
 *  - Best x402+ERC-7710: delegation proof embedded in every UserOp
 *  - Best A2A: each hop in the chain has its own encoded delegation struct
 *  - Best 1Shot: correct callData format for relayer_send7710Transaction
 */

import { encodeFunctionData, encodeAbiParameters, toFunctionSelector, type Hex, type Address } from 'viem'
import type { Delegation } from '@/types'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

/**
 * ModeCode.DEFAULT — single call execution mode for DeleGatorCore.
 * Required as the second argument to redeemDelegations().
 */
export const MODE_DEFAULT =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

/**
 * Minimal DeleGatorCore ABI — only the redeemDelegations function.
 * Full ABI lives in contracts/src/interfaces/ for reference.
 */
export const DELEGATOR_CORE_ABI = [
  {
    name: 'redeemDelegations',
    type: 'function',
    inputs: [
      {
        name: 'permissionContexts',
        type: 'bytes[][]',
      },
      {
        name: 'modes',
        type: 'bytes32[]',
      },
      {
        name: 'executionCallDatas',
        type: 'bytes[]',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

/** First 4 bytes of redeemDelegations(bytes[][],bytes32[],bytes[]) */
export function getRedeemDelegationsSelector(): Hex {
  return toFunctionSelector(
    'redeemDelegations(bytes[][],bytes32[],bytes[])',
  )
}

// ─── DELEGATION STRUCT ENCODING ──────────────────────────────────────────────

/**
 * ABI-encodes a single Delegation struct into bytes for use in permissionContexts.
 * Maps the ForgeOS Delegation type to the on-chain struct layout.
 */
export function encodeDelegationStruct(d: Delegation): Hex {
  const ROOT_AUTHORITY =
    '0x0000000000000000000000000000000000000000000000000000000000000000'

  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'delegate', type: 'address' },
          { name: 'delegator', type: 'address' },
          { name: 'authority', type: 'bytes32' },
          {
            name: 'caveats',
            type: 'tuple[]',
            components: [
              { name: 'enforcer', type: 'address' },
              { name: 'terms', type: 'bytes' },
              { name: 'args', type: 'bytes' },
            ],
          },
          { name: 'salt', type: 'bytes32' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    ],
    [
      {
        delegate: d.delegate,
        delegator: d.delegator,
        authority: d.authority === 'ROOT' ? ROOT_AUTHORITY as Hex : d.authority,
        caveats: d.caveats.map((c) => ({
          enforcer: c.enforcer,
          terms: c.terms,
          args: '0x' as Hex,
        })),
        salt: d.salt,
        signature: d.signature,
      },
    ],
  )
}

// ─── EXECUTION CALLDATA ENCODING ─────────────────────────────────────────────

/**
 * Encodes the inner execution for executionCallDatas[i].
 * Format: abi.encode(address target, uint256 value, bytes callData)
 */
export function encodeExecution(
  target: Address,
  value: bigint,
  callData: Hex,
): Hex {
  return encodeAbiParameters(
    [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'callData', type: 'bytes' },
    ],
    [target, value, callData],
  )
}

// ─── MAIN ENCODER ────────────────────────────────────────────────────────────

/**
 * Encodes the full redeemDelegations() calldata for a single action.
 *
 * @param delegations - Ordered delegation chain (most permissive first: root → sub → re)
 * @param innerTarget - Contract address the agent wants to call
 * @param innerCalldata - Calldata for the inner contract call
 * @param innerValue - ETH value for the inner call (usually 0n)
 * @returns ABI-encoded callData for the UserOp
 *
 * @example
 * // For a 2-hop A2A plan:
 * const callData = encodeRedeemDelegations(
 *   [rootDelegation, subDelegation],  // hop chain
 *   uniswapRouter,                     // inner target
 *   swapCalldata,                      // inner calldata
 *   0n,                                // no ETH value
 * )
 */
export function encodeRedeemDelegations(
  delegations: Delegation[],
  innerTarget: Address,
  innerCalldata: Hex,
  innerValue: bigint = 0n,
): Hex {
  // ABI-encode each delegation struct in the chain
  const encodedDelegations = delegations.map(encodeDelegationStruct)

  // Encode the inner execution target + value + calldata
  const executionCalldata = encodeExecution(innerTarget, innerValue, innerCalldata)

  // Build the redeemDelegations call:
  //   permissionContexts: [[...encoded chain]]  — outer array = batches (1 batch)
  //   modes:              [MODE_DEFAULT]          — single call mode
  //   executionCallDatas: [executionCalldata]     — one execution per batch
  return encodeFunctionData({
    abi: DELEGATOR_CORE_ABI,
    functionName: 'redeemDelegations',
    args: [
      [encodedDelegations],   // bytes[][] — one chain per batch
      [MODE_DEFAULT],          // bytes32[]
      [executionCalldata],     // bytes[]
    ],
  })
}
