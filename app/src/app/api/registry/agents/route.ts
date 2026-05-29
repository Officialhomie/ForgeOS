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
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { GET_AGENTS } from '@/lib/graph/queries'
import { queryGraph } from '@/lib/graph/client'
import { isGraphEnabled } from '@/lib/graph/config'
import { resolveRegistryMetadata } from '@/lib/registry/metadata'
import {
  clearAgentsCache,
  fetchRegistryLogsParallel,
  getCachedAgents,
  getPendingPublishedAgents,
  mergeAgentsWithPending,
  readAgentEndpoint,
  REGISTRY_ADDRESS,
  REGISTRY_READ_ABI,
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

async function agentsFromSubgraph(
  client: ReturnType<typeof createPublicClient>,
): Promise<MarketplaceAgentRow[] | null> {
  if (!isGraphEnabled()) return null
  try {
    const data = await queryGraph<{
      agents: Array<{
        id: string
        agentId: string
        name: string
        endpoint: string
        active: boolean
      }>
    }>(GET_AGENTS, { first: 100 })

    const active = data.agents.filter((a) => a.active)
    if (active.length === 0) return null

    return Promise.all(
      active.map(async (a) => {
        const agentId = a.agentId.startsWith('0x')
          ? (a.agentId as `0x${string}`)
          : (`0x${a.agentId}` as `0x${string}`)
        const metadataUri =
          a.endpoint || (await readAgentEndpoint(client, agentId)) || ''
        const metadata = metadataUri ? await resolveRegistryMetadata(metadataUri) : null
        let creator = '0x0000000000000000000000000000000000000000' as `0x${string}`
        try {
          const record = await client.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_READ_ABI,
            functionName: 'getAgent',
            args: [agentId],
          })
          creator = record.owner
          if (!metadataUri && record.endpoint) {
            const meta = await resolveRegistryMetadata(record.endpoint)
            return {
              agentId,
              creator,
              name: a.name || record.name,
              metadataUri: record.endpoint,
              metadata: meta,
              blockNumber: null,
              txHash: null,
            }
          }
        } catch {
          // use defaults
        }
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

async function agentsFromRpc(client: ReturnType<typeof createPublicClient>): Promise<MarketplaceAgentRow[]> {
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

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  if (!RPC_URL) {
    return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_RPC_URL not configured' }, { status: 503 })
  }

  const url = new URL(request.url)
  if (url.searchParams.get('refresh') === '1') {
    clearAgentsCache()
  }

  const cached = getCachedAgents<{
    agentId: `0x${string}`
    creator: `0x${string}`
    name: string
    metadataUri: string
    metadata: object | null
    blockNumber: string | null
    txHash: `0x${string}` | null
  }>()
  if (cached) {
    return NextResponse.json({ success: true, agents: cached, cached: true })
  }

  try {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(RPC_URL),
    })

    const pending = getPendingPublishedAgents()
    const forceFullScan = url.searchParams.get('refresh') === '1'

    const fromGraph = await agentsFromSubgraph(client)
    let onChain: MarketplaceAgentRow[] =
      fromGraph && fromGraph.length > 0 ? fromGraph : []

    if (onChain.length === 0) {
      const skipRpcForSpeed = pending.length > 0 && !forceFullScan
      if (!skipRpcForSpeed) {
        onChain = await agentsFromRpc(client)
      }
    }

    const agents = mergeAgentsWithPending(onChain, pending)

    setCachedAgents(agents)

    return NextResponse.json({
      success: true,
      agents,
      source: fromGraph?.length ? 'subgraph' : 'rpc',
      pendingCount: agents.filter((a) => 'pending' in a && a.pending).length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch agents'
    const status = /429|too many requests|rate limit/i.test(msg) ? 503 : 500
    return NextResponse.json({ success: false, error: msg, agents: [] }, { status })
  }
}
