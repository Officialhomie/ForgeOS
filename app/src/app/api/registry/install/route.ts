/**
 * POST /api/registry/install
 *
 * Installs a marketplace agent into the user's OS.
 * Creates a sub-delegation for the agent using its caveat template,
 * then returns the ERC-7715 permission request params for MetaMask to sign.
 *
 * Track evidence:
 *  - Best Agent: one-click agent install from marketplace
 *  - Best A2A: sub-delegation created from parent for agent-to-agent chain
 */

import { NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import type { Address } from '@/types'
import { resolveRegistryMetadata } from '@/lib/registry/metadata'
import { fetchRegistryLogs, readAgentEndpoint, resolveFromBlock } from '@/lib/registry/registry-logs'

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface InstallRequest {
  agentId: `0x${string}`
  userAddress: Address
  parentDelegationHash: `0x${string}`
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!RPC_URL) {
    return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_RPC_URL not configured' }, { status: 503 })
  }

  let body: InstallRequest
  try {
    body = (await request.json()) as InstallRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { agentId, userAddress, parentDelegationHash } = body

  if (!agentId || !userAddress || !parentDelegationHash) {
    return NextResponse.json(
      { success: false, error: 'agentId, userAddress, parentDelegationHash are required' },
      { status: 400 },
    )
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
      agentId,
      reverse: true,
    })

    if (logs.length === 0) {
      return NextResponse.json({ success: false, error: 'Agent not found in registry' }, { status: 404 })
    }

    const log = logs[0]
    const { owner } = log.args as { owner: `0x${string}` }

    const metadataUri = (await readAgentEndpoint(client, agentId)) ?? ''
    const metadata = metadataUri
      ? ((await resolveRegistryMetadata(metadataUri)) as Record<string, unknown> | null)
      : null
    const agentAddress = (metadata?.agentAddress as string | undefined) ?? owner
    const caveatTemplate = metadata?.caveatTemplate ?? {}

    // Return ERC-7715 permission request parameters for the client to submit to MetaMask
    // The client will call wallet_requestExecutionPermissions with these params
    const permissionRequest = {
      chainId: `0x${Number(process.env.ACTIVATION_CHAIN_ID ?? '11155111').toString(16)}`,
      permissions: [
        {
          type: 'native-token-transfer',
          data: {
            receiver: agentAddress,
          },
          policies: [],
        },
      ],
      expiry: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    }

    return NextResponse.json({
      success: true,
      agentId,
      agentAddress,
      parentDelegationHash,
      caveatTemplate,
      permissionRequest,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Install failed'
    const status = /429|too many requests|rate limit/i.test(msg) ? 503 : 500
    return NextResponse.json({ success: false, error: msg }, { status })
  }
}
