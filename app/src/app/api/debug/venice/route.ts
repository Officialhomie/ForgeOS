/**
 * GET /api/debug/venice
 *
 * Step-by-step Venice API diagnostic. Shows exactly what each endpoint
 * returns — status, headers, body — so you can see why auth or payment fails.
 *
 * Only available in development (NODE_ENV=development).
 * Access: http://localhost:3000/api/debug/venice
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { veniceChain } from '@/lib/wagmi/chains'
import { VENICE } from '@/lib/constants'
import { CONTRACTS } from '@/lib/contracts'
import { VENICE_CHAIN_ID } from '@/lib/chains/network'
import { walletEnvDiagnostics } from '@/lib/venice/client'

const ERC20_BALANCE_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

async function probeEndpoint(
  url: string,
  init: RequestInit,
  label: string,
): Promise<{
  label: string
  url: string
  method: string
  status: number | null
  statusText: string | null
  headers: Record<string, string>
  body: unknown
  latencyMs: number
  error: string | null
}> {
  const method = (init.method ?? 'GET').toUpperCase()
  const start = Date.now()
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) })
    const latencyMs = Date.now() - start
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    let body: unknown
    const ct = res.headers.get('content-type') ?? ''
    try {
      body = ct.includes('json') ? await res.json() : await res.text()
    } catch {
      body = '(could not parse body)'
    }
    return { label, url, method, status: res.status, statusText: res.statusText, headers, body, latencyMs, error: null }
  } catch (e) {
    return {
      label, url, method,
      status: null, statusText: null, headers: {}, body: null,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Debug endpoint only available in development' }, { status: 403 })
  }

  const baseUrl = VENICE.BASE_URL
  const apiKey = process.env.VENICE_API_KEY?.trim()
  const walletKey = process.env.AGENT_WALLET_KEY?.trim()
  const diag = walletEnvDiagnostics()

  // ── 1. Environment ──────────────────────────────────────────────────────────
  const env = {
    veniceBaseUrl: baseUrl,
    ...diag,
    mode: apiKey ? 'api-key' : walletKey ? 'local-wallet' : diag.hasTurnkeyFull ? 'turnkey' : 'unconfigured',
  }

  // ── 2. Wallet info (if AGENT_WALLET_KEY set) ─────────────────────────────────
  let walletInfo: Record<string, unknown> | null = null
  if (walletKey && /^0x[0-9a-fA-F]{64}$/.test(walletKey)) {
    try {
      const account = privateKeyToAccount(walletKey as `0x${string}`)
      const rpc = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? veniceChain.rpcUrls.default.http[0]
      const publicClient = createPublicClient({ chain: veniceChain, transport: http(rpc) })
      const [usdcBaseUnits, ethWei] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.usdcBase as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [account.address],
        }),
        publicClient.getBalance({ address: account.address }),
      ])
      walletInfo = {
        address: account.address,
        chainId: VENICE_CHAIN_ID,
        rpc,
        usdcContract: CONTRACTS.usdcBase,
        usdcOnBase: `${formatUnits(usdcBaseUnits, 6)} USDC`,
        usdcBaseUnits: usdcBaseUnits.toString(),
        ethOnBase: `${formatUnits(ethWei, 18)} ETH`,
      }
    } catch (e) {
      walletInfo = { error: e instanceof Error ? e.message : String(e) }
    }
  }

  // ── 3. Venice /models — connectivity check (no auth needed) ─────────────────
  const modelsProbe = await probeEndpoint(
    `${baseUrl}/models`,
    { method: 'GET' },
    'GET /models (no auth)',
  )

  // ── 4. Venice /models — with whatever auth is configured ────────────────────
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  let siweToken: string | null = null
  let siweError: string | null = null

  if (apiKey) {
    authHeaders['Authorization'] = `Bearer ${apiKey}`
  } else if (walletKey && /^0x[0-9a-fA-F]{64}$/.test(walletKey)) {
    try {
      const account = privateKeyToAccount(walletKey as `0x${string}`)
      const address = getAddress(account.address)
      const issuedAt = new Date()
      const expirationTime = new Date(issuedAt.getTime() + 10 * 60 * 1000)
      const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
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
      const signature = await account.signMessage({ message })
      const payload = { address, message, signature, timestamp: issuedAt.getTime(), chainId: VENICE_CHAIN_ID }
      siweToken = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
      authHeaders['X-Sign-In-With-X'] = siweToken
    } catch (e) {
      siweError = e instanceof Error ? e.message : String(e)
    }
  }

  const modelsWithAuthProbe = await probeEndpoint(
    `${baseUrl}/models`,
    { method: 'GET', headers: authHeaders },
    apiKey ? 'GET /models (Bearer API key)' : 'GET /models (SIWE auth)',
  )

  // ── 5. Probe /x402/balance/:address (if wallet configured) ──────────────────
  let balanceProbe = null
  if (walletKey && /^0x[0-9a-fA-F]{64}$/.test(walletKey) && !siweError) {
    const account = privateKeyToAccount(walletKey as `0x${string}`)
    balanceProbe = await probeEndpoint(
      `${baseUrl}/x402/balance/${account.address}`,
      { method: 'GET', headers: authHeaders },
      'GET /x402/balance/:address',
    )
  }

  // ── 6. Probe /chat/completions — capture the raw 402 ────────────────────────
  const chatProbe = await probeEndpoint(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        stream: false,
        max_tokens: 5,
      }),
    },
    'POST /chat/completions (minimal request)',
  )

  // ── 7. Probe /x402/top-up — capture what payment it requires ────────────────
  const topUpProbe = await probeEndpoint(
    `${baseUrl}/x402/top-up`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    },
    'POST /x402/top-up (payment probe)',
  )

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summary: string[] = []
  if (env.mode === 'api-key') {
    summary.push('Auth mode: Venice API key (Bearer)')
  } else if (env.mode === 'local-wallet') {
    summary.push('Auth mode: local AGENT_WALLET_KEY (SIWE + x402)')
    if (siweError) summary.push(`SIWE build failed: ${siweError}`)
    else summary.push('SIWE token built OK')
  } else {
    summary.push(`Auth mode: ${env.mode}`)
  }

  if (chatProbe.status === 200) {
    summary.push('Venice /chat/completions: OK — inference working')
  } else if (chatProbe.status === 402) {
    summary.push('Venice /chat/completions: 402 — payment required (check topUpProbe for amount needed)')
  } else if (chatProbe.status === 401) {
    summary.push('Venice /chat/completions: 401 — auth rejected (SIWE token format may be wrong, or API key invalid)')
  } else {
    summary.push(`Venice /chat/completions: ${chatProbe.status ?? 'error'} — ${chatProbe.error ?? ''}`)
  }

  if (topUpProbe.status === 402) {
    const body = topUpProbe.body as Record<string, unknown> | null
    const accepts = Array.isArray(body?.accepts) ? body!.accepts : []
    if (accepts.length > 0) {
      const offer = accepts[0] as Record<string, unknown>
      const amt = offer.maxAmountRequired ?? offer.amount ?? offer.maxAmount
      const usdcAmt = amt ? (Number(amt) / 1_000_000).toFixed(2) : 'unknown'
      summary.push(`Venice top-up: 402 — requires ${usdcAmt} USDC on Base`)
    } else {
      summary.push(`Venice top-up: 402 — no payment offer in response (check raw topUpProbe.body)`)
    }
  }

  return NextResponse.json({
    summary,
    env,
    walletInfo,
    siweToken: siweToken ? `${siweToken.slice(0, 60)}…` : null,
    siweError,
    probes: {
      models: modelsProbe,
      modelsWithAuth: modelsWithAuthProbe,
      x402Balance: balanceProbe,
      chatCompletions: chatProbe,
      x402TopUp: topUpProbe,
    },
  })
}
