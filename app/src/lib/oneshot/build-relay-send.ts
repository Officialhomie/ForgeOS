import { encodeFunctionData, parseUnits, type Address, type Hex } from 'viem'
import type { Delegation } from '@/types'
import { delegationTupleForEncoding } from '@/lib/delegation/normalize-for-encoding'
import type { UserOp } from '@/services/execution-engine/userop-builder'
export interface RelayChainCapability {
  feeCollector: `0x${string}`
  targetAddress: `0x${string}`
  acceptedTokens: Array<{
    address: `0x${string}`
    symbol: string
    decimals: number
  }>
}

export interface RelayFeeData {
  minFee: string
  context: string
  gasPrice?: string
  rate?: number
  expiry?: number
}

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export type RelayUserOpInput = Partial<UserOp> & {
  delegation?: Delegation
  delegationHash?: string
}

function delegationToRelayerJson(d: Delegation) {
  const t = delegationTupleForEncoding(d)
  return {
    delegate: t.delegate,
    delegator: t.delegator,
    authority: t.authority,
    caveats: t.caveats.map((c) => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: c.args,
    })),
    salt: t.salt,
    signature: t.signature,
  }
}

function resolvePermissionContext(op: RelayUserOpInput): ReturnType<typeof delegationToRelayerJson>[] {
  if (op.delegationProofs?.length) {
    return op.delegationProofs.map(delegationToRelayerJson)
  }
  if (op.delegation) {
    return [delegationToRelayerJson(op.delegation)]
  }
  return []
}

function parseFeeAmount(minFee: string, decimals: number): bigint {
  if (minFee.includes('.')) {
    return parseUnits(minFee, decimals)
  }
  return BigInt(minFee)
}

export function buildSend7710Params(opts: {
  chainId: number
  userOps: RelayUserOpInput[]
  capability: RelayChainCapability
  fee: RelayFeeData
  destinationUrl?: string
}): {
  chainId: string
  context: string
  destinationUrl?: string
  transactions: Array<{
    permissionContext: ReturnType<typeof delegationToRelayerJson>[]
    executions: Array<{ target: string; value: string; data: Hex }>
  }>
} {
  const paymentToken = opts.capability.acceptedTokens[0]
  if (!paymentToken) {
    throw new Error('Gasless relay is not available on this network right now.')
  }

  const feeAmount = parseFeeAmount(opts.fee.minFee, paymentToken.decimals)
  const feeTransferData = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [opts.capability.feeCollector, feeAmount],
  })

  const transactions: Array<{
    permissionContext: ReturnType<typeof delegationToRelayerJson>[]
    executions: Array<{ target: string; value: string; data: Hex }>
  }> = []

  let feeAttached = false

  for (const op of opts.userOps) {
    const permissionContext = resolvePermissionContext(op)
    if (permissionContext.length === 0) {
      throw new Error(
        '1Shot relay requires a signed ERC-7710 delegation (permissionContext). ' +
          'Pass delegationProofs on the UserOp or use wallet-paid transactions on Sepolia.',
      )
    }

    const executions: Array<{ target: string; value: string; data: Hex }> = []

    if (!feeAttached) {
      executions.push({
        target: paymentToken.address,
        value: '0',
        data: feeTransferData,
      })
      feeAttached = true
    }

    if (op.target && op.callData) {
      executions.push({
        target: op.target,
        value: op.value ?? '0',
        data: op.callData as Hex,
      })
    }

    if (executions.length === 0) {
      throw new Error('UserOp missing target and callData for relayer execution.')
    }

    transactions.push({ permissionContext, executions })
  }

  if (typeof opts.fee.context !== 'string' || !opts.fee.context) {
    throw new Error('1Shot relayer returned no fee quote context; retry in a few seconds.')
  }

  return {
    chainId: String(opts.chainId),
    context: opts.fee.context,
    destinationUrl: opts.destinationUrl,
    transactions,
  }
}
