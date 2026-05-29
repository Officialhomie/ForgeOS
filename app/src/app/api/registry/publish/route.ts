/**
 * POST /api/registry/publish
 *
 * Publishes an agent to the on-chain ForgeOSRegistry.
 * 1. Uploads metadata JSON to IPFS (via Pinata or inline base64 fallback)
 * 2. Calls ForgeOSRegistry.registerAgent(name, ipfsUri) via 1Shot relay
 * 3. Returns { agentId, ipfsUri, taskId }
 *
 * Track evidence:
 *  - Best Agent: on-chain registry with verifiable metadata URI
 *  - Best 1Shot: registry write dispatched via relayer_send7710Transaction
 */

import { NextResponse } from 'next/server'
import { keccak256, toHex, encodeFunctionData } from 'viem'
import { pinJson } from '@/lib/ipfs/client'
import { buildAndValidateUserOps } from '@/lib/delegation/proof-validation'
import { rootDelegationNeedsRelayResign } from '@/lib/delegation/needs-relay-resign'
import { getRelayTargetAddress, send7710Transaction } from '@/lib/oneshot/client'
import { addPendingPublishedAgent, clearAgentsCache } from '@/lib/registry/registry-logs'
import { ONESHOT, APP_URL } from '@/lib/constants'
import type { Address, Delegation } from '@/types'

function resolveWebhookUrl(): string {
  const explicit = process.env.ONESHOT_WEBHOOK_URL?.trim()
  if (explicit && !/trycloudflare\.com/i.test(explicit)) return explicit
  return `${APP_URL}/api/webhooks/1shot`
}

// ─── CONTRACT ─────────────────────────────────────────────────────────────────

const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ??
  '0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68'

const REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'endpoint', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'bytes32' }],
  },
] as const

// ─── REQUEST BODY ─────────────────────────────────────────────────────────────

interface PublishRequest {
  name: string
  description: string
  category: string
  promptTemplate: string
  caveatTemplate: object
  /** Protocol / template agent address stored in metadata */
  agentAddress: string
  /** User smart account (delegator) — required for 1Shot relay */
  smartAccountAddress?: string
  /** Root delegation from OS activation — required for gasless registerAgent */
  signedDelegations?: Delegation[]
  configSchema?: object
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: PublishRequest
  try {
    body = (await request.json()) as PublishRequest
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    name,
    description,
    category,
    promptTemplate,
    caveatTemplate,
    agentAddress,
    smartAccountAddress,
    signedDelegations = [],
    configSchema,
  } = body

  if (!name || !description || !agentAddress) {
    return NextResponse.json(
      { success: false, error: 'name, description, agentAddress are required' },
      { status: 400 },
    )
  }

  if (!signedDelegations.length) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Complete OS activation first (root delegation required). Open /activate and finish the Permissions step, then try Launch again.',
      },
      { status: 400 },
    )
  }

  try {
    // 1. Build and pin metadata
    const templateHash = keccak256(toHex(JSON.stringify(caveatTemplate)))

    const metadata = {
      name,
      description,
      category: category ?? 'custom',
      version: '1.0.0',
      promptTemplate,
      caveatTemplate,
      templateHash,
      agentAddress,
      configSchema: configSchema ?? {},
      createdAt: Math.floor(Date.now() / 1000),
    }

    const pin = await pinJson(metadata)
    const ipfsUri = pin.uri

    // 2. Encode registerAgent calldata
    const callData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [name, ipfsUri],
    })

    // 3. Wrap in redeemDelegations + dispatch via 1Shot relay
    const root = signedDelegations[0]
    const relayTarget = await getRelayTargetAddress(ONESHOT.CHAIN_ID)
    if (await rootDelegationNeedsRelayResign(root, ONESHOT.CHAIN_ID)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Your saved root delegation was signed for the wrong delegate (OSKernel). ' +
            'Open /activate, go to Permissions, and sign again so the delegation targets the 1Shot relayer wallet. ' +
            `Expected delegate ${relayTarget}, got ${root.delegate}.`,
        },
        { status: 400 },
      )
    }
    const delegator = (smartAccountAddress ?? root.delegator) as Address

    const userOps = buildAndValidateUserOps({
      actions: [
        {
          id: 'registry_publish',
          type: 'erc20_transfer',
          agentId: 'defi-rebalancer',
          delegationChain: [root.hash],
          target: REGISTRY_ADDRESS,
          calldata: callData,
          value: 0n,
          humanDescription: `Register marketplace agent "${name}"`,
          estimatedOutput: name,
          withinDelegationScope: true,
          dependsOn: [],
        },
      ],
      signedDelegations,
      senderAddress: delegator,
    })

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps,
      destinationUrl: resolveWebhookUrl(),
    })

    // On-chain agentId is keccak256(abi.encode(msg.sender, name, block.timestamp)) — available after relay confirms.
    const agentId = keccak256(toHex(`${name}:${agentAddress}:${Math.floor(Date.now() / 1000)}`))

    addPendingPublishedAgent({
      agentId,
      creator: delegator,
      name,
      metadataUri: ipfsUri,
      metadata,
      taskId,
      publishedAt: Date.now(),
    })
    clearAgentsCache()

    return NextResponse.json({
      success: true,
      agentId,
      ipfsUri,
      metadataSource: pin.source,
      pinataError: pin.pinataError ?? null,
      taskId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Publish failed'
    const duplicate = /duplicate|already registered|revert/i.test(msg)
    return NextResponse.json(
      { success: false, error: duplicate ? `Agent name "${name}" already registered` : msg },
      { status: duplicate ? 409 : 500 },
    )
  }
}
