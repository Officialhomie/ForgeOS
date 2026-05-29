import { parseUnits } from 'viem'
import {
  buildSend7710Params,
  type RelayChainCapability,
  type RelayFeeData,
  type RelayUserOpInput,
} from '@/lib/oneshot/build-relay-send'
import { resolveRelayerUrl } from '@/lib/oneshot/relayer-url'

export type { RelayChainCapability, RelayFeeData, RelayUserOpInput }

export interface RelaySubmitResult {
  taskId: string
}

type CapabilitiesByChain = Record<
  string,
  {
    feeCollector: `0x${string}`
    targetAddress: `0x${string}`
    tokens: Array<{
      address: `0x${string}`
      symbol: string
      decimals: string | number
    }>
  }
>

async function jsonRpc<T>(method: string, params: unknown, chainId: number): Promise<T> {
  const relayerUrl = resolveRelayerUrl(chainId)
  const apiKey = process.env.ONESHOT_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  let res: Response
  try {
    res = await fetch(relayerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(25_000),
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(
      `1Shot relayer unreachable at ${relayerUrl} (${detail}). ` +
        'Check ONESHOT_RELAYER_URL — use https://relayer.1shotapi.dev/relayers for Sepolia.',
    )
  }

  const body = (await res.json()) as {
    result?: T
    error?: { message: string; code?: number }
  }

  if (body.error) {
    throw new Error(body.error.message ?? '1Shot relayer error')
  }
  if (body.result === undefined) {
    throw new Error('1Shot relayer returned empty result')
  }
  return body.result
}

function parseCapabilityEntry(
  entry: CapabilitiesByChain[string] | undefined,
): RelayChainCapability | null {
  if (!entry?.tokens?.length) return null
  return {
    feeCollector: entry.feeCollector,
    targetAddress: entry.targetAddress,
    acceptedTokens: entry.tokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      decimals: typeof t.decimals === 'string' ? parseInt(t.decimals, 10) : t.decimals,
    })),
  }
}

let cachedTargetByChain: { chainId: number; targetAddress: `0x${string}` } | null = null

/** MetaMask DeleGator / smart-account target required as delegation `delegate` for 7710 relay. */
export async function getRelayTargetAddress(chainId: number): Promise<`0x${string}`> {
  if (cachedTargetByChain?.chainId === chainId) {
    return cachedTargetByChain.targetAddress
  }
  const cap = await getRelayCapabilities(chainId)
  cachedTargetByChain = { chainId, targetAddress: cap.targetAddress }
  return cap.targetAddress
}

export async function getRelayCapabilities(chainId: number): Promise<RelayChainCapability> {
  const result = await jsonRpc<CapabilitiesByChain>(
    'relayer_getCapabilities',
    [String(chainId)],
    chainId,
  )

  const cap = parseCapabilityEntry(result[String(chainId)])
  if (!cap) {
    throw new Error(
      'Gasless relay is not available on this network right now. ' +
        `Use ${resolveRelayerUrl(chainId)} for Sepolia (11155111) or Base Sepolia (84532).`,
    )
  }
  return cap
}

export async function getRelayFeeData(
  chainId: number,
  paymentToken: `0x${string}`,
): Promise<RelayFeeData> {
  const raw = await jsonRpc<{
    minFee: string
    context: string
    gasPrice?: string
    rate?: number
    expiry?: number
  }>(
    'relayer_getFeeData',
    { chainId: String(chainId), token: paymentToken },
    chainId,
  )

  return {
    minFee: raw.minFee,
    context: raw.context,
    gasPrice: raw.gasPrice,
    rate: raw.rate,
    expiry: raw.expiry,
  }
}

function normalizeTaskId(result: string | { taskId?: string }): string {
  if (typeof result === 'string') return result
  if (result?.taskId) return result.taskId
  throw new Error('1Shot relayer returned no task id')
}

export async function send7710Transaction(args: {
  chainId: number
  userOps: RelayUserOpInput[]
  destinationUrl?: string
}): Promise<RelaySubmitResult> {
  const capability = await getRelayCapabilities(args.chainId)
  const token = capability.acceptedTokens[0]?.address
  if (!token) {
    throw new Error('Gasless relay is not available on this network right now.')
  }

  const fee = await getRelayFeeData(args.chainId, token)
  const sendParams = buildSend7710Params({
    chainId: args.chainId,
    userOps: args.userOps,
    capability,
    fee,
    destinationUrl: args.destinationUrl,
  })

  try {
    const result = await jsonRpc<string | { taskId: string }>(
      'relayer_send7710Transaction',
      sendParams,
      args.chainId,
    )
    return { taskId: normalizeTaskId(result) }
  } catch (first) {
    await new Promise((r) => setTimeout(r, 1500))
    try {
      const result = await jsonRpc<string | { taskId: string }>(
        'relayer_send7710Transaction',
        sendParams,
        args.chainId,
      )
      return { taskId: normalizeTaskId(result) }
    } catch (second) {
      const err = second instanceof Error ? second : first
      const retryable = /congest|timeout|rate|503|502/i.test(String(err))
      if (retryable) {
        const message = err instanceof Error ? err.message : String(err)
        const e = new Error(message)
        ;(e as Error & { retryAfter?: number }).retryAfter = 5
        throw e
      }
      throw err
    }
  }
}

/** @deprecated Use getRelayCapabilities — kept for health checks */
export function parseMinFeeAtoms(minFee: string, decimals: number): bigint {
  if (minFee.includes('.')) return parseUnits(minFee, decimals)
  return BigInt(minFee)
}
