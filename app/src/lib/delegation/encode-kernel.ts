import { encodeFunctionData, type Hex } from 'viem'
import type { Delegation, Hash } from '@/types'
import { encodeDelegationStruct } from '@/lib/delegation/encode-redeem'

const OS_KERNEL_REDELEGATE_ABI = [
  {
    name: 'redelegate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'delegation',
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
      { name: 'parentHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'subDelegationHash', type: 'bytes32' }],
  },
] as const

const ROOT_AUTHORITY =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex

function delegationToKernelArgs(d: Delegation) {
  return {
    delegate: d.delegate,
    delegator: d.delegator,
    authority: d.authority === 'ROOT' ? ROOT_AUTHORITY : d.authority,
    caveats: d.caveats.map((c) => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: '0x' as Hex,
    })),
    salt: d.salt,
    signature: d.signature,
  }
}

export function encodeKernelRedelegateCalldata(
  delegation: Delegation,
  parentHash: Hash,
): Hex {
  return encodeFunctionData({
    abi: OS_KERNEL_REDELEGATE_ABI,
    functionName: 'redelegate',
    args: [delegationToKernelArgs(delegation), parentHash],
  })
}

/** Exported for audit / debugging */
export function delegationStructBytes(d: Delegation): Hex {
  return encodeDelegationStruct(d)
}
