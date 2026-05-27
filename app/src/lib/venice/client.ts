/**
 * Venice AI client — SIWE auth + x402 payment flow.
 *
 * Server-side only. Requires AGENT_WALLET_KEY in env.
 *
 * Flow:
 *   1. Build SIWE message signed by agent wallet (24 h cache).
 *   2. POST to Venice with X-Sign-In-With-Ethereum header.
 *   3. On 401 → clear SIWE cache and retry once.
 *   4. On 402 → parse payment details, execute USDC transfer on Base,
 *      include X-Payment receipt header, retry.
 */

import { createWalletClient, http, type Hex, type Address, type LocalAccount } from 'viem'
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

interface X402PaymentRequired {
  accepts: Array<{
    scheme: string
    network: string
    maxAmountRequired: string
    resource: string
    payTo: string
    asset: string
  }>
}

export class VenicePaymentRequired extends Error {
  constructor(public readonly details: X402PaymentRequired) {
    super('Venice x402: payment required')
    this.name = 'VenicePaymentRequired'
  }
}

// ─── VENICE CLIENT ────────────────────────────────────────────────────────────

export class VeniceClient {
  private readonly account: LocalAccount
  private readonly walletClient: ReturnType<typeof createWalletClient>
  private readonly baseUrl: string
  private siweCache: { token: string; expiresAt: number } | null = null

  constructor(account: LocalAccount) {
    this.account = account
    this.walletClient = createWalletClient({
      account: this.account,
      chain: veniceChain,
      transport: http(
        process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0],
      ),
    })
    this.baseUrl = VENICE.BASE_URL
  }

  get address(): Address {
    return this.account.address
  }

  // ── SIWE Auth ──────────────────────────────────────────────────────────────

  private async buildSiweToken(): Promise<string> {
    const issuedAt = new Date()
    const expirationTime = new Date(issuedAt.getTime() + 24 * 60 * 60 * 1000)
    const nonce = Math.random().toString(36).slice(2, 18)

    const message = [
      'api.venice.ai wants you to sign in with your Ethereum account:',
      this.account.address,
      '',
      'Sign in to Venice AI — ForgeOS agent inference',
      '',
      'URI: https://api.venice.ai',
      'Version: 1',
      `Chain ID: ${VENICE_CHAIN_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt.toISOString()}`,
      `Expiration Time: ${expirationTime.toISOString()}`,
    ].join('\n')

    let signature: `0x${string}`
    try {
      signature = await this.account.signMessage({ message })
    } catch (e) {
      // Reset the singleton so the next request rebuilds the client (e.g. refreshed Turnkey creds)
      _clientPromise = null
      const raw = e instanceof Error ? e.message : String(e)
      const isFetchError = raw.includes('fetch failed') || raw.includes('Failed to sign')
      throw new Error(
        isFetchError
          ? `Agent wallet signing failed — network error reaching the signing service. ` +
            `If you are using Turnkey, check your API credentials. ` +
            `For local dev, set AGENT_WALLET_KEY=0x<privateKey> in .env.local as a fallback. ` +
            `(Raw: ${raw})`
          : `Agent wallet signing failed: ${raw}`,
      )
    }

    this.siweCache = {
      token: `${message}\n${signature}`,
      expiresAt: Math.floor(expirationTime.getTime() / 1000),
    }

    return this.siweCache.token
  }

  private async getSiweToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.siweCache && now < this.siweCache.expiresAt - 300) {
      return this.siweCache.token
    }
    return this.buildSiweToken()
  }

  // ── x402 Payment ──────────────────────────────────────────────────────────

  private async executeX402Payment(details: X402PaymentRequired): Promise<string> {
    const { payTo, maxAmountRequired, asset } = details.accepts[0]

    // Transfer USDC from agent wallet to Venice payee
    const txHash = await this.walletClient.writeContract({
      address: (asset || CONTRACTS.usdcBase) as Address,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [payTo as Address, BigInt(maxAmountRequired)],
      account: this.account,
      chain: veniceChain,
    })

    const receipt = JSON.stringify({
      x402Version: 1,
      scheme: 'exact',
      network: 'base-mainnet',
      payload: {
        from: this.account.address,
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
    opts: { retried?: boolean; paymentHeader?: string } = {},
  ): Promise<{ data: T; promptTokens: number; completionTokens: number }> {
    const siwe = await this.getSiweToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sign-In-With-Ethereum': siwe,
    }
    if (opts.paymentHeader) {
      headers['X-Payment'] = opts.paymentHeader
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // 401 — SIWE expired, re-auth once
    if (res.status === 401 && !opts.retried) {
      this.siweCache = null
      return this.request(path, body, { retried: true, paymentHeader: opts.paymentHeader })
    }

    // 402 — x402 payment required
    if (res.status === 402) {
      if (opts.paymentHeader) {
        // Already tried to pay — surface as typed error
        const details = (await res.json()) as X402PaymentRequired
        throw new VenicePaymentRequired(details)
      }
      const details = (await res.json()) as X402PaymentRequired
      const paymentHeader = await this.executeX402Payment(details)
      return this.request(path, body, { paymentHeader })
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
    value: BigInt(a.value ?? 0),
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
    estimatedCost: BigInt(parsed.estimatedCost ?? 40000),
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

export function getVeniceClient(): Promise<VeniceClient> {
  if (!_clientPromise) {
    _clientPromise = _buildClient()
    // Auto-clear on rejection so the next call can retry instead of re-throwing forever
    _clientPromise.catch(() => { _clientPromise = null })
  }
  return _clientPromise
}

async function _buildClient(): Promise<VeniceClient> {
  // ① Prefer Turnkey HSM when fully configured
  if (hasTurnkeyConfig()) {
    try {
      const address = process.env.TURNKEY_WALLET_ADDRESS as Address
      const account = await createTurnkeyAccount(address)
      return new VeniceClient(account as LocalAccount)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[ForgeOS] Turnkey account creation failed: ${msg}`)
      // Fall through to local-key fallback
    }
  }

  // ② Raw private key (dev / non-HSM deployments)
  const key = process.env.AGENT_WALLET_KEY
  if (key) {
    return new VeniceClient(privateKeyToAccount(key as Hex))
  }

  throw new Error(
    'Agent wallet not configured. ' +
    'Set AGENT_WALLET_KEY=0x<privateKey> in .env.local for local dev, ' +
    'or ensure all five TURNKEY_* vars are valid.',
  )
}

/** True if the agent wallet is configured via either path. */
export function hasAgentWallet(): boolean {
  return hasTurnkeyConfig() || !!process.env.AGENT_WALLET_KEY
}
