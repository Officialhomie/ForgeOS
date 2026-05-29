/**
 * GET /api/health
 *
 * Probes each external service and returns per-service status + latency.
 * Used by the dashboard health bar to surface real-time system status.
 *
 * Services checked:
 *  - Venice AI  (chat completions endpoint — HEAD/OPTIONS probe)
 *  - 1Shot relay (relayer_getCapabilities — validates API key + relay is live)
 *  - Chain RPC   (eth_blockNumber on Sepolia)
 *  - Agent wallet (AGENT_WALLET_KEY or Turnkey vars configured)
 */

import { NextResponse } from 'next/server'
import { VENICE, ONESHOT } from '@/lib/constants'
import { hasAgentWallet } from '@/lib/venice/client'
import { forgeChain } from '@/lib/wagmi/chains'

export type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unconfigured'

export interface ServiceHealth {
  status: ServiceStatus
  latencyMs: number | null
  detail?: string
}

export interface HealthResponse {
  ok: boolean
  timestamp: number
  services: {
    venice: ServiceHealth
    oneshot: ServiceHealth
    chain: ServiceHealth
    wallet: ServiceHealth
    subgraph: ServiceHealth
  }
  /** Overall end-to-end readiness — true only if all critical services are ok */
  ready: boolean
}

// ─── PROBES ──────────────────────────────────────────────────────────────────

function isTimeoutError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /timeout|aborted|timed out/i.test(msg)
}

async function probeVenice(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    const res = await fetch(`${VENICE.BASE_URL}/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    if (res.ok || res.status === 401) {
      // 401 = reachable but needs auth — that is expected without a key on /models
      return { status: 'ok', latencyMs }
    }
    return { status: 'degraded', latencyMs, detail: `HTTP ${res.status}` }
  } catch (e) {
    return {
      status: isTimeoutError(e) ? 'degraded' : 'error',
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : 'Unreachable',
    }
  }
}

async function probeOneshot(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const apiKey = process.env.ONESHOT_API_KEY
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const res = await fetch(ONESHOT.RELAYER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'relayer_getCapabilities',
        params: [String(ONESHOT.CHAIN_ID)],
      }),
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    const body = (await res.json()) as {
      result?: Record<string, { tokens?: unknown[] }>
      error?: { message: string }
    }
    const chainCap = body.result?.[String(ONESHOT.CHAIN_ID)]
    if (res.ok && chainCap?.tokens?.length) {
      return { status: 'ok', latencyMs, detail: ONESHOT.RELAYER_URL }
    }
    if (res.ok) {
      return {
        status: 'degraded',
        latencyMs,
        detail: `No payment tokens on chain ${ONESHOT.CHAIN_ID} (${ONESHOT.RELAYER_URL})`,
      }
    }
    return {
      status: 'degraded',
      latencyMs,
      detail: body.error?.message ?? `HTTP ${res.status}`,
    }
  } catch (e) {
    return {
      status: isTimeoutError(e) ? 'degraded' : 'error',
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : 'Unreachable',
    }
  }
}

async function probeChain(): Promise<ServiceHealth> {
  const rpcUrl = forgeChain.rpcUrls.default.http[0]

  const start = Date.now()
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) return { status: 'degraded', latencyMs, detail: `HTTP ${res.status}` }
    const json = (await res.json()) as { result?: string; error?: { message: string } }
    if (json.error) return { status: 'degraded', latencyMs, detail: json.error.message }
    return { status: 'ok', latencyMs, detail: `Block ${parseInt(json.result ?? '0', 16)}` }
  } catch (e) {
    return {
      status: isTimeoutError(e) ? 'degraded' : 'error',
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : 'Unreachable',
    }
  }
}

function probeWallet(): ServiceHealth {
  if (hasAgentWallet()) {
    return { status: 'ok', latencyMs: 0, detail: 'Configured' }
  }
  return {
    status: 'unconfigured',
    latencyMs: null,
    detail: 'Set AGENT_WALLET_KEY or TURNKEY_* vars in .env.local',
  }
}


async function probeSubgraph(): Promise<ServiceHealth> {
  const url = process.env.NEXT_PUBLIC_SUBGRAPH_URL
  if (!url || url.trim() === '') {
    return { status: 'unconfigured', latencyMs: null, detail: 'NEXT_PUBLIC_SUBGRAPH_URL not set' }
  }

  const start = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ _meta { block { number } hasIndexingErrors } }' }),
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    const json = (await res.json()) as {
      data?: { _meta: { block: { number: number }; hasIndexingErrors: boolean } }
      errors?: { message: string }[]
    }
    if (json.errors?.length) {
      const msg = json.errors[0].message
      if (msg.includes('not started syncing')) {
        return { status: 'degraded', latencyMs, detail: 'Initializing — syncing from deploy block' }
      }
      return { status: 'error', latencyMs, detail: msg.slice(0, 80) }
    }
    if (json.data?._meta) {
      const { block, hasIndexingErrors } = json.data._meta
      if (hasIndexingErrors) {
        return { status: 'degraded', latencyMs, detail: `Indexing errors at block ${block.number}` }
      }
      return { status: 'ok', latencyMs, detail: `Block ${block.number}` }
    }
    return { status: 'error', latencyMs, detail: 'Empty response' }
  } catch (e) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      detail: e instanceof Error ? e.message : 'Unreachable',
    }
  }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function GET() {
  const [venice, oneshot, chain, subgraph] = await Promise.all([
    probeVenice(),
    probeOneshot(),
    probeChain(),
    probeSubgraph(),
  ])

  const wallet = probeWallet()

  // subgraph + wallet config are non-blocking for dashboard UX
  const critical = [venice, oneshot, chain]
  const allOk = critical.every((s) => s.status === 'ok')
  const anyError = critical.some((s) => s.status === 'error')

  const body: HealthResponse = {
    ok: !anyError,
    timestamp: Math.floor(Date.now() / 1000),
    services: { venice, oneshot, chain, wallet, subgraph },
    ready: allOk,
  }

  // Always HTTP 200 — readiness is expressed in JSON (`ok`, `ready`, per-service status).
  // Avoids noisy 503 logs when a probe is slow or temporarily unreachable.
  return NextResponse.json(body, { status: 200 })
}
