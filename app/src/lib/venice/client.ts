/**
 * Venice AI client — SIWE auth + x402 payment flow.
 *
 * Server-side only. Requires AGENT_WALLET_KEY in env.
 *
 * Flow:
 *   1. Build SIWE message signed by agent wallet (24 h cache).
 *   2. POST to Venice with X-Sign-In-With-X (base64 JSON SIWE payload).
 *   3. On 401 → clear SIWE cache and retry once.
 *   4. On 402 → parse payment details, execute USDC transfer on Base,
 *      include X-402-Payment receipt header, retry.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  formatUnits,
  type Hex,
  type Address,
  type LocalAccount,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hasTurnkeyConfig, createTurnkeyAccount } from '@/lib/venice/turnkey-signer'
import { veniceChain } from '@/lib/wagmi/chains'
import { VENICE_CHAIN_ID } from '@/lib/chains/network'
import { VENICE } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import type {
  ActionPlan,
  AgentId,
  PlannedAction,
  ActionType,
  VeniceSystemContext,
} from '@/types'

// ─── MINIMAL ERC-20 ABI FOR TRANSFER ─────────────────────────────────────────

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
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

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface VeniceMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletion {
  id: string
  choices: Array<{
    message: { role: string; content: string }
    finish_reason: string
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  model: string
}

export interface EmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}

interface X402AcceptOffer {
  scheme?: string
  network?: string
  maxAmountRequired?: string
  amount?: string
  maxAmount?: string
  resource?: string
  payTo?: string
  to?: string
  asset?: string
}

interface X402PaymentRequired {
  accepts: X402AcceptOffer[]
}

function parseX402PaymentDetails(
  bodyText: string,
  paymentRequiredHeader: string | null,
): X402PaymentRequired | null {
  let fromBody: X402PaymentRequired | null = null
  try {
    const json = JSON.parse(bodyText) as Record<string, unknown>
    if (Array.isArray(json.accepts) && json.accepts.length > 0) {
      fromBody = { accepts: json.accepts as X402AcceptOffer[] }
    }
  } catch {
    fromBody = null
  }

  if (fromBody?.accepts?.length) return fromBody
  if (!paymentRequiredHeader) return fromBody

  const candidates = [paymentRequiredHeader.trim()]
  try {
    candidates.push(Buffer.from(paymentRequiredHeader, 'base64').toString('utf8'))
  } catch {
    // not base64
  }

  for (const raw of candidates) {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(json.accepts) && json.accepts.length > 0) {
        return { accepts: json.accepts as X402AcceptOffer[] }
      }
      if (Array.isArray(json)) {
        return { accepts: json as X402AcceptOffer[] }
      }
    } catch {
      // try next candidate
    }
  }

  return fromBody
}

function normalizeX402Offer(raw: X402AcceptOffer) {
  const maxAmountRequired = raw.maxAmountRequired ?? raw.amount ?? raw.maxAmount
  const payTo = raw.payTo ?? raw.to
  if (!maxAmountRequired || !payTo) {
    throw new Error(
      `Invalid Venice x402 payment offer (missing amount or payTo): ${JSON.stringify(raw).slice(0, 200)}`,
    )
  }
  return {
    scheme: raw.scheme ?? 'exact',
    network: raw.network ?? 'base',
    maxAmountRequired: String(maxAmountRequired),
    resource: raw.resource ?? '',
    payTo,
    asset: raw.asset ?? CONTRACTS.usdcBase,
  }
}

function formatUsdcBaseUnits(amount: bigint): string {
  return formatUnits(amount, 6)
}

function parseInference402Hint(bodyText: string): { minimumUsd?: number; currentUsd?: number } {
  try {
    const json = JSON.parse(bodyText) as {
      minimumBalanceUsd?: number
      suggestedTopUpUsd?: number
      currentBalanceUsd?: number
    }
    return {
      minimumUsd: json.minimumBalanceUsd ?? json.suggestedTopUpUsd,
      currentUsd: json.currentBalanceUsd,
    }
  } catch {
    return {}
  }
}

export interface AgentFundingSnapshot {
  address: Address
  chainId: number
  usdcContract: Address
  /** Verified via balanceOf on Base mainnet RPC */
  baseUsdc: string
  baseUsdcBaseUnits: string
  baseEth: string
  venicePrepaidUsd: number | null
  veniceCanConsume: boolean | null
}

export function formatFundingSnapshot(s: AgentFundingSnapshot, requiredTopUpUsdc?: string): string {
  const lines = [
    `Verified on Base mainnet (chain ${s.chainId}, RPC):`,
    `• Agent wallet: ${s.address}`,
    `• USDC on Base: ${s.baseUsdc} USDC`,
    `• ETH on Base (gas): ${s.baseEth} ETH`,
    `• Venice prepaid credits: ${s.venicePrepaidUsd != null ? `$${s.venicePrepaidUsd.toFixed(2)}` : 'unknown'}`,
  ]
  if (requiredTopUpUsdc) {
    lines.push(`• Venice top-up required: ${requiredTopUpUsdc} USDC`)
  }
  return lines.join('\n')
}

function agentTopUpShortfallMessage(
  snapshot: AgentFundingSnapshot,
  required: bigint,
): string {
  const have = BigInt(snapshot.baseUsdcBaseUnits)
  const shortfall = required > have ? required - have : 0n
  return (
    `${formatFundingSnapshot(snapshot, formatUsdcBaseUnits(required))}\n\n` +
    `You have ${formatUsdcBaseUnits(have)} USDC on Base but Venice needs ${formatUsdcBaseUnits(required)} USDC to top up. ` +
    (shortfall > 0n
      ? `Send at least ${formatUsdcBaseUnits(shortfall)} more USDC on Base mainnet to ${snapshot.address}, then retry.`
      : 'Retry the command.')
  )
}

function safeBigInt(value: unknown, fallback = 0n): bigint {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'bigint') return value
  try {
    if (typeof value === 'number') return BigInt(Math.trunc(value))
    return BigInt(String(value))
  } catch {
    return fallback
  }
}

export class VenicePaymentRequired extends Error {
  constructor(public readonly details: X402PaymentRequired) {
    super('Venice x402: payment required')
    this.name = 'VenicePaymentRequired'
  }
}

/** Inference 402 — prepaid x402 credits exhausted (not the /x402/top-up payment flow). */
export class VeniceInsufficientBalanceError extends Error {
  constructor(
    message: string,
    public readonly walletAddress: Address,
  ) {
    super(message)
    this.name = 'VeniceInsufficientBalanceError'
  }
}

export class VeniceWalletError extends Error {
  constructor(
    public readonly code: 'WALLET_UNCONFIGURED' | 'TURNKEY_SIGN_FAILED' | 'WALLET_SIGN_FAILED' | 'WALLET_NETWORK_ERROR',
    message: string,
  ) {
    super(message)
    this.name = 'VeniceWalletError'
  }
}

function classifySignError(raw: string): VeniceWalletError {
  if (raw.includes('Turnkey error')) {
    if (raw.includes('Could not find any resource to sign with')) {
      return new VeniceWalletError(
        'TURNKEY_SIGN_FAILED',
        'Turnkey signing failed: TURNKEY_PRIVATE_KEY_ID does not match TURNKEY_WALLET_ADDRESS (addresses are case-sensitive). ' +
          'Fix those IDs in .env.local, set VENICE_WALLET_SOURCE=local to use AGENT_WALLET_KEY, or remove the Turnkey vars.',
      )
    }
    return new VeniceWalletError('TURNKEY_SIGN_FAILED', `Turnkey signing failed: ${raw}`)
  }
  if (raw.includes('fetch failed')) {
    return new VeniceWalletError(
      'WALLET_NETWORK_ERROR',
      'Could not reach the wallet signing service. Check your network and Turnkey API credentials.',
    )
  }
  return new VeniceWalletError('WALLET_SIGN_FAILED', `Agent wallet signing failed: ${raw}`)
}

// ─── VENICE CLIENT ────────────────────────────────────────────────────────────

export class VeniceClient {
  private readonly account: LocalAccount | null
  private readonly walletClient: ReturnType<typeof createWalletClient> | null
  private readonly baseUrl: string
  /** Set when constructed from a Venice API key — skips SIWE auth and x402 payments entirely. */
  private readonly apiKey: string | null
  private siweCache: { token: string; expiresAt: number } | null = null

  /**
   * @param accountOrApiKey  A viem LocalAccount (SIWE + x402 flow) OR a Venice API key string
   *                         (Bearer auth — no wallet or payment required).
   */
  constructor(accountOrApiKey: LocalAccount | string) {
    if (typeof accountOrApiKey === 'string') {
      this.apiKey = accountOrApiKey
      this.account = null
      this.walletClient = null
    } else {
      this.apiKey = null
      this.account = accountOrApiKey
      this.walletClient = createWalletClient({
        account: this.account,
        chain: veniceChain,
        transport: http(
          process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0],
        ),
      })
    }
    this.baseUrl = VENICE.BASE_URL
  }

  get address(): Address {
    if (!this.account) throw new Error('Venice client is in API key mode — no wallet configured')
    return this.account.address
  }

  // ── SIWE Auth ──────────────────────────────────────────────────────────────

  /** Returns true when using a Venice API key (no wallet / x402 needed). */
  get isApiKeyMode(): boolean {
    return !!this.apiKey
  }

  private async buildSiweToken(): Promise<string> {
    // Only called when !this.apiKey, so account is guaranteed non-null
    const issuedAt = new Date()
    const expirationTime = new Date(issuedAt.getTime() + 10 * 60 * 1000)
    const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    const address = getAddress(this.account!.address)

    const message = [
      'outerface.venice.ai wants you to sign in with your Ethereum account:',
      address,
      '',
      'Sign in to Venice API',
      '',
      'URI: https://outerface.venice.ai',
      'Version: 1',
      `Chain ID: ${VENICE_CHAIN_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expirationTime.toISOString()}`,
    ].join('\n')

    let signature: `0x${string}`
    try {
      signature = await this.account!.signMessage({ message })
    } catch (e) {
      // Reset the singleton so the next request rebuilds the client (e.g. refreshed Turnkey creds)
      _clientPromise = null
      const raw = e instanceof Error ? e.message : String(e)
      throw classifySignError(raw)
    }

    const payload = {
      address,
      message,
      signature,
      timestamp: issuedAt.getTime(),
      chainId: VENICE_CHAIN_ID,
    }
    const token = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')

    this.siweCache = {
      token,
      expiresAt: Math.floor(expirationTime.getTime() / 1000),
    }

    return token
  }

  private async getSiweToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.siweCache && now < this.siweCache.expiresAt - 300) {
      return this.siweCache.token
    }
    return this.buildSiweToken()
  }

  // ── x402 Payment ──────────────────────────────────────────────────────────

  private async readAgentUsdcOnBase(token: Address): Promise<bigint> {
    const client = createPublicClient({
      chain: veniceChain,
      transport: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0],
      ),
    })
    return client.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.account!.address],
    })
  }

  /** On-chain Base USDC + Venice prepaid balance. Throws in API key mode (no wallet). */
  async getFundingSnapshot(): Promise<AgentFundingSnapshot> {
    if (this.apiKey || !this.account) {
      throw new Error('Venice client is in API key mode — wallet balance check unavailable')
    }
    const token = CONTRACTS.usdcBase as Address
    const [usdcBaseUnits, ethWei, venice] = await Promise.all([
      this.readAgentUsdcOnBase(token),
      createPublicClient({
        chain: veniceChain,
        transport: http(
          process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0],
        ),
      }).getBalance({ address: this.account.address }),
      this.fetchVenicePrepaidBalance(),
    ])
    return {
      address: this.account.address,
      chainId: VENICE_CHAIN_ID,
      usdcContract: token,
      baseUsdc: formatUsdcBaseUnits(usdcBaseUnits),
      baseUsdcBaseUnits: usdcBaseUnits.toString(),
      baseEth: formatUnits(ethWei, 18),
      venicePrepaidUsd: venice.balanceUsd,
      veniceCanConsume: venice.canConsume,
    }
  }

  private async fetchVenicePrepaidBalance(): Promise<{
    balanceUsd: number | null
    canConsume: boolean | null
  }> {
    try {
      const siwe = await this.getSiweToken()
      const res = await fetch(`${this.baseUrl}/x402/balance/${this.account!.address}`, {
        headers: { 'X-Sign-In-With-X': siwe },
      })
      if (!res.ok) return { balanceUsd: null, canConsume: null }
      const json = (await res.json()) as { balanceUsd?: number; canConsume?: boolean }
      return {
        balanceUsd: json.balanceUsd ?? null,
        canConsume: json.canConsume ?? null,
      }
    } catch {
      return { balanceUsd: null, canConsume: null }
    }
  }

  private async assertAgentUsdcForTopUp(required: bigint, token: Address): Promise<void> {
    const snapshot = await this.getFundingSnapshot()
    const available = BigInt(snapshot.baseUsdcBaseUnits)
    const ethWei = await createPublicClient({
      chain: veniceChain,
      transport: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0],
      ),
    }).getBalance({ address: snapshot.address })
    if (ethWei === 0n) {
      throw new VeniceInsufficientBalanceError(
        `${formatFundingSnapshot(snapshot, formatUsdcBaseUnits(required))}\n\n` +
          `You have USDC on Base but 0 ETH for gas. Send ~0.001 ETH on Base mainnet to ${snapshot.address} ` +
          `so the Venice top-up transfer can execute, then retry.`,
        snapshot.address,
      )
    }
    if (available < required) {
      throw new VeniceInsufficientBalanceError(
        agentTopUpShortfallMessage(snapshot, required),
        snapshot.address,
      )
    }
  }

  /** Auto top-up Venice prepaid x402 balance by executing a USDC payment on Base. No-op in API key mode. */
  private async topUp(requiredBaseUnits?: bigint): Promise<void> {
    if (this.apiKey) return
    await this.request('/x402/top-up', {}, { topUpRequired: requiredBaseUnits })
  }

  private async executeX402Payment(details: X402PaymentRequired): Promise<string> {
    const raw = details.accepts?.[0]
    if (!raw) {
      throw new Error('Venice x402 top-up response did not include payment offers (accepts[0])')
    }
    const { payTo, maxAmountRequired, asset } = normalizeX402Offer(raw)
    const amount = BigInt(maxAmountRequired)
    await this.assertAgentUsdcForTopUp(amount, asset as Address)

    let txHash: `0x${string}`
    try {
      txHash = await this.walletClient!.writeContract({
        address: asset as Address,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [payTo as Address, amount],
        account: this.account!,
        chain: veniceChain,
      })
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : String(e)
      if (rawMsg.includes('exceeds balance') || rawMsg.includes('insufficient funds')) {
        const snapshot = await this.getFundingSnapshot()
        throw new VeniceInsufficientBalanceError(
          agentTopUpShortfallMessage(snapshot, amount),
          snapshot.address,
        )
      }
      throw e
    }

    const receipt = JSON.stringify({
      x402Version: 1,
      scheme: 'exact',
      network: 'base-mainnet',
      payload: {
        from: this.account!.address,
        to: payTo,
        value: maxAmountRequired,
        txHash,
      },
    })

    return Buffer.from(receipt).toString('base64')
  }

  // ── Core Request ───────────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    opts: { retried?: boolean; paymentHeader?: string; topUpRequired?: bigint } = {},
  ): Promise<{ data: T; promptTokens: number; completionTokens: number }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (this.apiKey) {
      // API key mode: simple Bearer auth — no SIWE, no x402
      headers['Authorization'] = `Bearer ${this.apiKey}`
    } else {
      const siwe = await this.getSiweToken()
      headers['X-Sign-In-With-X'] = siwe
    }

    if (opts.paymentHeader) {
      headers['X-402-Payment'] = opts.paymentHeader
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // 401 — SIWE expired, re-auth once (only relevant in SIWE mode)
    if (res.status === 401 && !opts.retried && !this.apiKey) {
      this.siweCache = null
      return this.request(path, body, { retried: true, paymentHeader: opts.paymentHeader })
    }

    // 402 — only applies to SIWE/x402 auth mode; API key billing is handled server-side by Venice
    if (res.status === 402 && !this.apiKey) {
      const bodyText = await res.text()
      const paymentRequiredHeader =
        res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required')
      const parsed = parseX402PaymentDetails(bodyText, paymentRequiredHeader)
      const accepts = parsed?.accepts ?? []
      if (opts.paymentHeader) {
        throw new VenicePaymentRequired(parsed ?? { accepts: [] })
      }

      // Top-up endpoint: execute USDC payment on Base then retry
      if (path.endsWith('/x402/top-up') && accepts.length > 0) {
        const paymentHeader = await this.executeX402Payment(parsed!)
        return this.request(path, body, { paymentHeader })
      }

      // Top-up returned 402 without parseable offers — do not recurse
      if (path.endsWith('/x402/top-up')) {
        throw new VeniceInsufficientBalanceError(
          `Venice x402 top-up could not parse payment offers. Ensure agent wallet ${this.account!.address} has USDC on Base.`,
          this.account!.address,
        )
      }

      // Inference endpoint: auto top-up Venice prepaid balance then retry once
      if (!opts.retried) {
        let required = opts.topUpRequired ?? 5_000_000n
        if (accepts.length > 0) {
          try {
            required = BigInt(normalizeX402Offer(accepts[0]).maxAmountRequired)
          } catch {
            // use default / hint below
          }
        } else {
          const hint = parseInference402Hint(bodyText)
          if (hint.minimumUsd != null) {
            required = BigInt(Math.ceil(hint.minimumUsd * 1_000_000))
          }
        }
        await this.assertAgentUsdcForTopUp(required, CONTRACTS.usdcBase as Address)
        await this.topUp(required)
        return this.request(path, body, { retried: true })
      }

      throw new VeniceInsufficientBalanceError(
        `Venice x402 balance still too low after auto top-up. Check agent wallet ${this.account!.address} has USDC on Base mainnet.`,
        this.account!.address,
      )
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Venice API ${res.status}: ${text}`)
    }

    const json = (await res.json()) as T & {
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }

    const asCompletion = json as unknown as ChatCompletion
    return {
      data: json,
      promptTokens: asCompletion.usage?.prompt_tokens ?? 0,
      completionTokens: asCompletion.usage?.completion_tokens ?? 0,
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async chat(params: {
    model?: string
    messages: VeniceMessage[]
  }): Promise<{ completion: ChatCompletion; promptTokens: number; completionTokens: number }> {
    const { data, promptTokens, completionTokens } = await this.request<ChatCompletion>(
      '/chat/completions',
      {
        model: params.model ?? VENICE.DEFAULT_MODEL,
        messages: params.messages,
        stream: false,
      },
    )
    return { completion: data, promptTokens, completionTokens }
  }

  async embeddings(params: {
    model?: string
    input: string | string[]
  }): Promise<number[]> {
    const { data } = await this.request<EmbeddingsResponse>('/embeddings', {
      model: params.model ?? VENICE.EMBEDDINGS_MODEL,
      input: params.input,
    })
    return data.data[0]?.embedding ?? []
  }

  // ── Intent Parsing (ForgeOS specific) ─────────────────────────────────────

  async parseIntent(
    intent: string,
    context?: Partial<VeniceSystemContext>,
  ): Promise<ActionPlan> {
    const systemPrompt = buildSystemPrompt(context)

    const { completion, promptTokens, completionTokens } = await this.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: intent },
      ],
    })

    const content = completion.choices[0]?.message.content ?? '{}'
    return parseActionPlan(content, intent, completion.model)
  }
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

function buildSystemPrompt(context?: Partial<VeniceSystemContext>): string {
  const policy = context?.policy
  const delegations = context?.activeDelegations ?? []

  return `You are ForgeOS, an autonomous agent OS on Ethereum. You parse user intents into structured action plans.

Active delegations: ${delegations.length} agent(s) have active permissions.
${policy ? `Policy: max $${Number(policy.monthlySpendCap) / 1_000_000} USDC/month, categories: ${policy.allowedCategories.join(', ')}` : ''}

Respond ONLY with valid JSON matching this schema:
{
  "summary": "<one-sentence plan description>",
  "actions": [
    {
      "id": "<unique id>",
      "type": "<erc20_swap|erc20_transfer|stake|unstake|nft_buy|nft_sell|subscription_pay|redelegate|portfolio_read>",
      "agentId": "<defi-rebalancer|payment-executor|nft-lifeguard|data-broker|social-poster>",
      "target": "<contract address or 0x0 for read>",
      "calldata": "0x",
      "value": 0,
      "humanDescription": "<plain English action>",
      "estimatedOutput": "<expected result>",
      "withinDelegationScope": true,
      "dependsOn": []
    }
  ],
  "estimatedCost": 40000,
  "withinPolicy": true,
  "policyViolations": []
}`
}

// ─── RESPONSE PARSER ──────────────────────────────────────────────────────────

function parseActionPlan(content: string, intent: string, model: string): ActionPlan {
  const id = `plan_${Math.random().toString(36).slice(2, 10)}`

  // Extract JSON from response (Venice may wrap it in markdown)
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  const raw = jsonMatch ? jsonMatch[0] : '{}'

  let parsed: Partial<{
    summary: string
    actions: Partial<PlannedAction>[]
    estimatedCost: number
    withinPolicy: boolean
    policyViolations: string[]
  }>

  try {
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    parsed = {}
  }

  const actions: PlannedAction[] = (parsed.actions ?? []).map((a, i) => ({
    id: a.id ?? `action_${i}`,
    type: (a.type as ActionType) ?? 'portfolio_read',
    agentId: (a.agentId as AgentId) ?? 'defi-rebalancer',
    delegationChain: [],
    target: (a.target as `0x${string}`) ?? '0x0000000000000000000000000000000000000000',
    calldata: (a.calldata as `0x${string}`) ?? '0x',
    value: safeBigInt(a.value, 0n),
    humanDescription: a.humanDescription ?? '',
    estimatedOutput: a.estimatedOutput ?? '',
    withinDelegationScope: a.withinDelegationScope ?? true,
    dependsOn: a.dependsOn ?? [],
  }))

  return {
    id,
    intent,
    summary: parsed.summary ?? intent,
    actions,
    estimatedCost: safeBigInt(parsed.estimatedCost, 40_000n),
    estimatedGas: 0n,
    withinPolicy: parsed.withinPolicy ?? true,
    policyViolations: parsed.policyViolations ?? [],
    generatedAt: Math.floor(Date.now() / 1000),
    veniceModel: model,
  }
}

// ─── SINGLETON ────────────────────────────────────────────────────────────────

// Promise-based singleton: safe against concurrent initialization on cold start.
// Cleared on failure so the next request can retry (transient network errors, etc.)
let _clientPromise: Promise<VeniceClient> | null = null

export async function getAgentFundingSnapshot(): Promise<AgentFundingSnapshot> {
  const client = await getVeniceClient()
  if (client.isApiKeyMode) {
    throw new Error(
      'Wallet balance check is not available when using VENICE_API_KEY. ' +
        'Add AGENT_WALLET_KEY to see on-chain balances.',
    )
  }
  return client.getFundingSnapshot()
}

export function isBalanceCheckIntent(intent: string): boolean {
  const t = intent.toLowerCase()
  return (
    /\b(balance|funds|usdc)\b/.test(t) &&
    /\b(check|show|what|how much|read|view|my)\b/.test(t)
  )
}

export function getVeniceClient(): Promise<VeniceClient> {
  if (!_clientPromise) {
    _clientPromise = _buildClient()
    // Auto-clear on rejection so the next call can retry instead of re-throwing forever
    _clientPromise.catch(() => { _clientPromise = null })
  }
  return _clientPromise
}

/** Safe wallet env diagnostics (no secrets). */
export function walletEnvDiagnostics() {
  const turnkeyVars = [
    'TURNKEY_API_PUBLIC_KEY',
    'TURNKEY_API_PRIVATE_KEY',
    'TURNKEY_ORGANIZATION_ID',
    'TURNKEY_PRIVATE_KEY_ID',
    'TURNKEY_WALLET_ADDRESS',
  ] as const
  const turnkeyPresent = turnkeyVars.filter((v) => !!process.env[v])
  const rawKey = process.env.AGENT_WALLET_KEY
  return {
    hasAgentWallet: hasAgentWallet(),
    hasVeniceApiKey: !!process.env.VENICE_API_KEY?.trim(),
    hasTurnkeyFull: hasTurnkeyConfig(),
    turnkeyVarsSet: turnkeyPresent.length,
    turnkeyVarsMissing: turnkeyVars.filter((v) => !process.env[v]),
    agentKeyPresent: !!rawKey,
    agentKeyLen: rawKey?.length ?? 0,
    agentKeyLooksHex: !!rawKey && /^0x[0-9a-fA-F]{64}$/.test(rawKey.trim()),
  }
}

function buildLocalVeniceClient(key: string): VeniceClient {
  const trimmed = key.trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new VeniceWalletError(
      'WALLET_SIGN_FAILED',
      'AGENT_WALLET_KEY must be a 32-byte hex private key (0x followed by 64 hex characters).',
    )
  }
  return new VeniceClient(privateKeyToAccount(trimmed as Hex))
}

async function _buildClient(): Promise<VeniceClient> {
  // ① Venice API key — simplest path, no wallet or x402 required
  const veniceApiKey = process.env.VENICE_API_KEY?.trim()
  if (veniceApiKey) {
    return new VeniceClient(veniceApiKey)
  }

  const diag = walletEnvDiagnostics()
  const key = process.env.AGENT_WALLET_KEY
  const forceTurnkey = process.env.VENICE_WALLET_SOURCE === 'turnkey'

  // ② Local key when set (default — Turnkey must not shadow AGENT_WALLET_KEY unless forced)
  if (key && !forceTurnkey) {
    return buildLocalVeniceClient(key)
  }

  // ② Turnkey HSM (production or VENICE_WALLET_SOURCE=turnkey)
  if (hasTurnkeyConfig()) {
    try {
      const address = getAddress(process.env.TURNKEY_WALLET_ADDRESS as Address)
      const account = await createTurnkeyAccount(address)
      return new VeniceClient(account as LocalAccount)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[ForgeOS] Turnkey account creation failed: ${msg}`)
      if (!key) {
        throw new VeniceWalletError('TURNKEY_SIGN_FAILED', `Turnkey wallet setup failed: ${msg}`)
      }
      // Fall through to local-key fallback
    }
  }

  // ③ Local key fallback after Turnkey failure
  if (key) {
    return buildLocalVeniceClient(key)
  }

  const missing = diag.turnkeyVarsMissing.length
    ? `Missing Turnkey vars: ${diag.turnkeyVarsMissing.join(', ')}. `
    : ''
  throw new VeniceWalletError(
    'WALLET_UNCONFIGURED',
    `${missing}Set AGENT_WALLET_KEY in app/.env.local (server-only) and restart the dev server.`,
  )
}

/** True if Venice can be called — via API key, Turnkey HSM, or local wallet key. */
export function hasAgentWallet(): boolean {
  return (
    !!process.env.VENICE_API_KEY?.trim() ||
    hasTurnkeyConfig() ||
    !!process.env.AGENT_WALLET_KEY
  )
}
