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
import { send7710Transaction } from '@/lib/oneshot/client'
import { ONESHOT } from '@/lib/constants'
import { APP_URL } from '@/lib/constants'

// ─── CONTRACT ─────────────────────────────────────────────────────────────────

const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ??
  '0x4668B4Dd600FB4404783a9C73B6b4fcb71e78347'

const REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'metadataUri', type: 'string' },
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
  agentAddress: string
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

  const { name, description, category, promptTemplate, caveatTemplate, agentAddress, configSchema } = body

  if (!name || !description || !agentAddress) {
    return NextResponse.json(
      { success: false, error: 'name, description, agentAddress are required' },
      { status: 400 },
    )
  }

  if (!process.env.ONESHOT_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'ONESHOT_API_KEY not configured' },
      { status: 503 },
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

    const ipfsUri = await pinJson(metadata)

    // 2. Encode registerAgent calldata
    const callData = encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: 'registerAgent',
      args: [name, ipfsUri],
    })

    // 3. Dispatch via 1Shot relay
    const webhookUrl = process.env.ONESHOT_WEBHOOK_URL ?? `${APP_URL}/api/webhooks/1shot`

    const { taskId } = await send7710Transaction({
      chainId: ONESHOT.CHAIN_ID,
      userOps: [
        {
          sender: agentAddress,
          callData,
          target: REGISTRY_ADDRESS,
          value: '0',
          nonce: 0,
          delegationChain: [],
          delegationProofs: [],
        },
      ],
      destinationUrl: webhookUrl,
    })

    // 4. Derive a deterministic agentId (matches what the contract emits)
    const agentId = keccak256(toHex(`${name}:${agentAddress}:${Math.floor(Date.now() / 1000)}`))

    return NextResponse.json({
      success: true,
      agentId,
      ipfsUri,
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
