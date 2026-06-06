/**
 * GET /api/registry/agents
 *
 * Reads AgentRegistered events from ForgeOSRegistry on-chain and returns
 * a normalized agent list with on-chain metadata.
 *
 * Uses eth_getLogs via the public RPC so no subgraph required.
 *
 * Track evidence:
 *  - Best Agent: on-chain registry browsable by any user
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http, type PublicClient } from 'viem'
import { sepolia } from 'viem/chains'
import { GET_AGENTS } from '@/lib/graph/queries'
import { queryGraph } from '@/lib/graph/client'
import { isGraphEnabled } from '@/lib/graph/config'
import { resolveRegistryMetadata } from '@/lib/registry/metadata'
import {
  clearAgentsCache,
  fetchRegistryLogsParallel,
  getCachedAgents,
  isCacheStale,
  getPendingPublishedAgents,
  mergeAgentsWithPending,
  readAgentEndpoint,
  resolveListingFromBlock,
  setCachedAgents,
} from '@/lib/registry/registry-logs'

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL

type MarketplaceAgentRow = {
  agentId: `0x${string}`
  creator: `0x${string}`
  name: string
  metadataUri: string
  metadata: object | null
  blockNumber: string | null
  txHash: `0x${string}` | null
}

async function agentsFromSubgraph(): Promise<MarketplaceAgentRow[] | null> {
  if (!isGraphEnabled()) return null
  try {
    const data = await queryGraph<{
      agents: Array<{
        id: string
        agentId: string
        owner?: string
        name: string
        endpoint: string
        active: boolean
      }>
    }>(GET_AGENTS, { first: 100 })

    const active = data.agents.filter((a) => a.active)
    // Return empty array (not null) when subgraph is healthy but has 0 agents.
    // The caller treats null as "subgraph error → fall to RPC".
    if (active.length === 0) return []

    return Promise.all(
      active.map(async (a) => {
        const agentId = a.agentId.startsWith('0x')
          ? (a.agentId as `0x${string}`)
          : (`0x${a.agentId}` as `0x${string}`)

        // owner is indexed by the subgraph since the schema update.
        // Fall back to zero address for agents indexed before the upgrade.
        const creator: `0x${string}` = a.owner
          ? (a.owner.startsWith('0x') ? a.owner : `0x${a.owner}`) as `0x${string}`
          : '0x0000000000000000000000000000000000000000'

        // endpoint is stored by the subgraph (fetched from contract at index time).
        // No per-agent readContract call needed.
        const metadataUri = a.endpoint || ''
        const metadata = metadataUri ? await resolveRegistryMetadata(metadataUri) : null

        return {
          agentId,
          creator,
          name: a.name,
          metadataUri,
          metadata,
          blockNumber: null,
          txHash: null,
        }
      }),
    )
  } catch {
    return null
  }
}

async function agentsFromRpc(client: PublicClient): Promise<MarketplaceAgentRow[]> {
  const configuredFromBlock = BigInt(process.env.REGISTRY_DEPLOY_BLOCK ?? '0')
  const latestBlock = await client.getBlockNumber()
  const fromBlock = resolveListingFromBlock(latestBlock, configuredFromBlock)

  const logs = await fetchRegistryLogsParallel(client, {
    fromBlock,
    toBlock: latestBlock,
  })

  return Promise.all(
    logs.map(async (log) => {
      const { agentId, owner, name } = log.args as {
        agentId: `0x${string}`
        owner: `0x${string}`
        name: string
      }

      const metadataUri = (await readAgentEndpoint(client, agentId)) ?? ''
      const metadata = metadataUri ? await resolveRegistryMetadata(metadataUri) : null

      return {
        agentId,
        creator: owner,
        name,
        metadataUri,
        metadata,
        blockNumber: log.blockNumber?.toString() ?? null,
        txHash: log.transactionHash,
      }
    }),
  )
}

// ─── RPC SCAN TIMEOUT ─────────────────────────────────────────────────────────

const RPC_SCAN_TIMEOUT_MS = Number(process.env.REGISTRY_RPC_SCAN_TIMEOUT_MS ?? '8000')

/** Wraps agentsFromRpc with a hard timeout. Returns [] on timeout instead of hanging. */
async function agentsFromRpcSafe(client: PublicClient): Promise<MarketplaceAgentRow[]> {
  return Promise.race([
    agentsFromRpc(client),
    new Promise<MarketplaceAgentRow[]>((resolve) =>
      setTimeout(() => resolve([]), RPC_SCAN_TIMEOUT_MS),
    ),
  ])
}

// ─── BACKGROUND REFRESH ────────────────────────────────────────────────────────

let isRefreshing = false

async function refreshCacheBackground(client: PublicClient): Promise<void> {
  if (isRefreshing) return
  isRefreshing = true
  try {
    const fromGraph = await agentsFromSubgraph()
    const onChain: MarketplaceAgentRow[] = fromGraph ?? await agentsFromRpcSafe(client)
    const withPending = mergeAgentsWithPending(onChain, getPendingPublishedAgents())
    if (withPending.length > 0) setCachedAgents(withPending)
  } finally {
    isRefreshing = false
  }
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!RPC_URL) {
    return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_RPC_URL not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  if (url.searchParams.get('refresh') === '1') {
    clearAgentsCache()
  }

  type AgentRow = {
    agentId: `0x${string}`
    creator: `0x${string}`
    name: string
    metadataUri: string
    metadata: object | null
    blockNumber: string | null
    txHash: `0x${string}` | null
  }

  const pending = getPendingPublishedAgents()
  const cached = getCachedAgents<AgentRow>()

  if (cached) {
    const agents = mergeAgentsWithPending(cached, pending)
    // Stale-while-revalidate: cache is valid but getting old — refresh in the background
    // so the *next* request is already fast. Never blocks the current response.
    if (isCacheStale() && RPC_URL) {
      const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) }) as PublicClient
      void refreshCacheBackground(client)
    }
    return NextResponse.json({ success: true, agents, cached: true })
  }

  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    }) as PublicClient

    const forceFullScan = url.searchParams.get('refresh') === '1'

    const fromGraph = await agentsFromSubgraph()
    // fromGraph === null  → subgraph query failed → fall to RPC (expensive)
    // fromGraph === []    → subgraph healthy, 0 agents indexed yet → trust it
    // fromGraph.length>0  → use subgraph data
    let onChain: MarketplaceAgentRow[] = fromGraph ?? []

    if (fromGraph === null) {
      // Subgraph is unreachable — hit Alchemy only when necessary
      const skipRpcForSpeed = pending.length > 0 && !forceFullScan
      if (!skipRpcForSpeed) {
        onChain = await agentsFromRpcSafe(client)
      }
    }

    const agents = mergeAgentsWithPending(onChain, pending)

    setCachedAgents(agents)

    return NextResponse.json({
      success: true,
      agents,
      source: fromGraph !== null ? 'subgraph' : 'rpc',
      pendingCount: agents.filter((a) => 'pending' in a && a.pending).length,
    })
  } catch (e) {
    // Return pending agents rather than a 500 so the marketplace isn't blank
    if (pending.length > 0) {
      return NextResponse.json({ success: true, agents: pending, stale: true })
    }
    const msg = e instanceof Error ? e.message : 'Failed to fetch agents'
    const status = /429|too many requests|rate limit/i.test(msg) ? 503 : 500
    return NextResponse.json({ success: false, error: msg, agents: [] }, { status })
  }
}
