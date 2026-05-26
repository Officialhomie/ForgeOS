const RELAYER_URL =
  process.env.ONESHOT_RELAYER_URL ?? 'https://relayer.1shotapi.com/relayers'

export interface RelayCapabilities {
  acceptedTokens: `0x${string}`[]
}

export interface RelayFeeData {
  convertedFee: bigint
  minFee: bigint
  context: unknown
}

export interface RelaySubmitResult {
  taskId: string
}

async function jsonRpc<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  const apiKey = process.env.ONESHOT_API_KEY
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(RELAYER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  const body = (await res.json()) as {
    result?: T
    error?: { message: string }
  }

  if (body.error) {
    throw new Error(body.error.message ?? '1Shot relayer error')
  }
  if (body.result === undefined) {
    throw new Error('1Shot relayer returned empty result')
  }
  return body.result
}

export async function getRelayCapabilities(
  chainId: number,
): Promise<RelayCapabilities> {
  return jsonRpc<RelayCapabilities>('relayer_getCapabilities', [chainId])
}

export async function getRelayFeeData(
  chainId: number,
  paymentToken: `0x${string}`,
): Promise<RelayFeeData> {
  const raw = await jsonRpc<{
    convertedFee: string
    minFee: string
    context: unknown
  }>('relayer_getFeeData', [chainId, paymentToken])

  return {
    convertedFee: BigInt(raw.convertedFee),
    minFee: BigInt(raw.minFee),
    context: raw.context,
  }
}

export async function send7710Transaction(args: {
  chainId: number
  userOps: unknown[]
  destinationUrl?: string
}): Promise<RelaySubmitResult> {
  const caps = await getRelayCapabilities(args.chainId)
  const token = caps.acceptedTokens[0]
  if (!token) throw new Error('No accepted payment tokens from 1Shot')

  const fee = await getRelayFeeData(args.chainId, token)
  const feeAmount =
    fee.convertedFee > fee.minFee ? fee.convertedFee : fee.minFee

  return jsonRpc<RelaySubmitResult>('relayer_send7710Transaction', [
    {
      userOps: args.userOps,
      paymentToken: token,
      feeAmount: feeAmount.toString(),
      context: fee.context,
      destinationUrl: args.destinationUrl,
    },
  ])
}
