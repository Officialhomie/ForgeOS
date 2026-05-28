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
import {
  fetchRegistryLogs,
  getCachedAgents,
  resolveFromBlock,
  setCachedAgents,
} from '@/lib/registry/registry-logs'

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL

// ─── IPFS RESOLUTION ─────────────────────────────────────────────────────────

async function resolveMetadata(uri: string): Promise<object | null> {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.replace('data:application/json;base64,', '')
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as object
    }
    if (uri.startsWith('ipfs://')) {
      const cid = uri.replace('ipfs://', '')
      const res = await fetch(`https://ipfs.io/ipfs/${cid}`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      return (await res.json()) as object
    }
  } catch {
    // noop — return null if metadata fetch fails
  }
  return null
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function GET() {
  if (!RPC_URL) {
    return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_RPC_URL not configured' }, { status: 503 })
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

    const configuredFromBlock = BigInt(process.env.REGISTRY_DEPLOY_BLOCK ?? '0')
    const latestBlock = await client.getBlockNumber()
    const fromBlock = resolveFromBlock(latestBlock, configuredFromBlock)

    const logs = await fetchRegistryLogs(client, {
      fromBlock,
      toBlock: latestBlock,
    })

    const agents = await Promise.all(
      logs.map(async (log) => {
        const { agentId, creator, name, metadataUri } = log.args as {
          agentId: `0x${string}`
          creator: `0x${string}`
          name: string
          metadataUri: string
        }

        const metadata = metadataUri ? await resolveMetadata(metadataUri) : null

        return {
          agentId,
          creator,
          name,
          metadataUri,
          metadata,
          blockNumber: log.blockNumber?.toString() ?? null,
          txHash: log.transactionHash,
        }
      }),
    )

    setCachedAgents(agents)

    return NextResponse.json({ success: true, agents })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch agents'
    const status = /429|too many requests|rate limit/i.test(msg) ? 503 : 500
    return NextResponse.json({ success: false, error: msg, agents: [] }, { status })
  }
}
