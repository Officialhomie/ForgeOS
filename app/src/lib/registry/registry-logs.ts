/**
 * Chunked eth_getLogs helper for ForgeOSRegistry.
 *
 * Alchemy free tier allows only 10-block ranges and rate-limits burst traffic.
 * This module throttles requests, retries on 429, and caches agent lists briefly.
 */

import type { GetLogsReturnType, PublicClient } from 'viem'
import { parseAbi, parseAbiItem } from 'viem'

/** Must match ForgeOSRegistry.sol — endpoint is not in the event; use getAgent(). */
export const AGENT_REGISTERED_EVENT = parseAbiItem(
  'event AgentRegistered(bytes32 indexed agentId, address indexed owner, string name)',
)

export const REGISTRY_READ_ABI = parseAbi([
  'function getAgent(bytes32 agentId) view returns ((address owner, string name, string endpoint, bool active, uint256 registeredAt))',
])

export type AgentRegisteredLog = GetLogsReturnType<typeof AGENT_REGISTERED_EVENT>[number]

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ??
  '0xDE52F54c88510F9eC584f514CEAB4b965bbf2A68'

export function getLogScanConfig() {
  return {
    blockRange: Number(process.env.RPC_LOG_BLOCK_RANGE ?? '10'),
    maxRequests: Number(process.env.RPC_MAX_LOG_REQUESTS ?? '24'),
    delayMs: Number(process.env.RPC_LOG_DELAY_MS ?? '250'),
    maxRetries: Number(process.env.RPC_LOG_MAX_RETRIES ?? '4'),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /429|too many requests|rate limit/i.test(msg)
}

async function getLogsWithRetry(
  client: PublicClient,
  params: Parameters<PublicClient['getLogs']>[0],
  maxRetries: number,
): Promise<AgentRegisteredLog[]> {
  let attempt = 0
  while (true) {
    try {
      return (await client.getLogs(params)) as AgentRegisteredLog[]
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetries) throw error
      const backoffMs = Math.min(8000, 1000 * 2 ** attempt)
      await sleep(backoffMs)
      attempt += 1
    }
  }
}

/** Install / single-agent lookup: full history from deploy block when set. */
export function resolveFromBlock(latestBlock: bigint, configuredFromBlock: bigint): bigint {
  if (configuredFromBlock > 0n) {
    return configuredFromBlock
  }
  const { blockRange, maxRequests } = getLogScanConfig()
  const boundedFromBlock =
    latestBlock > BigInt(blockRange * maxRequests)
      ? latestBlock - BigInt(blockRange * maxRequests) + 1n
      : 0n
  return boundedFromBlock
}

/**
 * Marketplace listing: scan recent blocks from chain tip (Alchemy free = 10-block chunks).
 * Avoids scanning thousands of blocks from REGISTRY_DEPLOY_BLOCK on every page load.
 */
export function resolveListingFromBlock(latestBlock: bigint, configuredFromBlock: bigint): bigint {
  const scanDepth = BigInt(process.env.REGISTRY_LIST_SCAN_BLOCKS ?? '600')
  const fromRecent = latestBlock > scanDepth ? latestBlock - scanDepth + 1n : 0n
  if (configuredFromBlock > 0n && configuredFromBlock > fromRecent) {
    return configuredFromBlock
  }
  return fromRecent
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function buildBlockChunks(fromBlock: bigint, toBlock: bigint, step: bigint): Array<{ from: bigint; to: bigint }> {
  const chunks: Array<{ from: bigint; to: bigint }> = []
  let cursor = fromBlock
  while (cursor <= toBlock) {
    const chunkTo = cursor + step - 1n > toBlock ? toBlock : cursor + step - 1n
    chunks.push({ from: cursor, to: chunkTo })
    cursor = chunkTo + 1n
  }
  return chunks
}

export async function readAgentEndpoint(
  client: PublicClient,
  agentId: `0x${string}`,
): Promise<string | null> {
  try {
    const record = await client.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_READ_ABI,
      functionName: 'getAgent',
      args: [agentId],
    })
    return record.endpoint || null
  } catch {
    return null
  }
}

export interface FetchRegistryLogsOptions {
  fromBlock: bigint
  toBlock: bigint
  agentId?: `0x${string}`
  /** Scan newest blocks first (useful for install lookups). */
  reverse?: boolean
}

/** Parallel chunked getLogs — faster on Alchemy free tier (10-block windows). */
export async function fetchRegistryLogsParallel(
  client: PublicClient,
  options: FetchRegistryLogsOptions,
): Promise<AgentRegisteredLog[]> {
  const { fromBlock, toBlock, agentId } = options
  const { blockRange, maxRetries } = getLogScanConfig()
  const step = BigInt(Math.max(1, blockRange))
  const concurrency = Number(process.env.RPC_LOG_CONCURRENCY ?? '2')
  const batchDelayMs = Number(process.env.RPC_LOG_BATCH_DELAY_MS ?? '300')
  const chunks = buildBlockChunks(fromBlock, toBlock, step)

  const parts: AgentRegisteredLog[][] = []
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(({ from, to }) =>
        getLogsWithRetry(
          client,
          {
            address: REGISTRY_ADDRESS,
            event: AGENT_REGISTERED_EVENT,
            args: agentId ? { agentId } : undefined,
            fromBlock: from,
            toBlock: to,
          },
          maxRetries,
        ),
      ),
    )
    parts.push(...batchResults)
    if (i + concurrency < chunks.length && batchDelayMs > 0) {
      await sleep(batchDelayMs)
    }
  }

  const logs = parts.flat()
  if (agentId && logs.length > 0) return logs
  return logs
}

export async function fetchRegistryLogs(
  client: PublicClient,
  options: FetchRegistryLogsOptions,
): Promise<AgentRegisteredLog[]> {
  const { fromBlock, toBlock, agentId, reverse = false } = options
  const span = toBlock >= fromBlock ? toBlock - fromBlock + 1n : 0n
  const parallelThreshold = BigInt(process.env.RPC_LOG_PARALLEL_MIN_BLOCKS ?? '40')
  if (span >= parallelThreshold && !reverse) {
    return fetchRegistryLogsParallel(client, options)
  }

  const { blockRange, delayMs, maxRetries } = getLogScanConfig()
  const step = BigInt(Math.max(1, blockRange))
  const logs: AgentRegisteredLog[] = []

  if (reverse) {
    let cursor = toBlock
    while (cursor >= fromBlock) {
      const windowStart = cursor >= step - 1n ? cursor - (step - 1n) : 0n
      const chunkFrom = windowStart > fromBlock ? windowStart : fromBlock
      const chunk = await getLogsWithRetry(
        client,
        {
          address: REGISTRY_ADDRESS,
          event: AGENT_REGISTERED_EVENT,
          args: agentId ? { agentId } : undefined,
          fromBlock: chunkFrom,
          toBlock: cursor,
        },
        maxRetries,
      )
      logs.push(...chunk)
      if (agentId && chunk.length > 0) return logs
      if (chunkFrom === fromBlock) break
      cursor = chunkFrom - 1n
      if (delayMs > 0) await sleep(delayMs)
    }
    return logs
  }

  let cursor = fromBlock
  while (cursor <= toBlock) {
    const chunkTo = cursor + step - 1n > toBlock ? toBlock : cursor + step - 1n
    const chunk = await getLogsWithRetry(
      client,
      {
        address: REGISTRY_ADDRESS,
        event: AGENT_REGISTERED_EVENT,
        args: agentId ? { agentId } : undefined,
        fromBlock: cursor,
        toBlock: chunkTo,
      },
      maxRetries,
    )
    logs.push(...chunk)
    cursor = chunkTo + 1n
    if (cursor <= toBlock && delayMs > 0) await sleep(delayMs)
  }

  return logs
}

// ─── AGENTS LIST CACHE ────────────────────────────────────────────────────────

const AGENTS_CACHE_TTL_MS = Number(process.env.REGISTRY_AGENTS_CACHE_MS ?? '120000')

interface AgentsCacheEntry {
  agents: unknown[]
  fetchedAt: number
}

let agentsCache: AgentsCacheEntry | null = null

export function getCachedAgents<T>(): T[] | null {
  if (!agentsCache) return null
  if (Date.now() - agentsCache.fetchedAt > AGENTS_CACHE_TTL_MS) {
    agentsCache = null
    return null
  }
  const agents = agentsCache.agents as T[]
  // Never serve a cached empty list — RPC may have failed or scan missed recent registrations.
  if (agents.length === 0) return null
  return agents
}

export function setCachedAgents(agents: unknown[]) {
  if (agents.length === 0) return
  agentsCache = { agents, fetchedAt: Date.now() }
}

export function clearAgentsCache() {
  agentsCache = null
}

// ─── PENDING PUBLISHES (until on-chain log is indexed / scanned) ───────────────

export interface PendingRegistryAgent {
  agentId: `0x${string}`
  creator: `0x${string}`
  name: string
  metadataUri: string
  metadata: object | null
  taskId: string | null
  publishedAt: number
}

const pendingPublished: PendingRegistryAgent[] = []

export function addPendingPublishedAgent(agent: PendingRegistryAgent) {
  const idx = pendingPublished.findIndex(
    (a) => a.metadataUri === agent.metadataUri || a.name === agent.name,
  )
  if (idx >= 0) pendingPublished[idx] = agent
  else pendingPublished.push(agent)
  clearAgentsCache()
}

export function getPendingPublishedAgents(): PendingRegistryAgent[] {
  const maxAgeMs = Number(process.env.REGISTRY_PENDING_MAX_AGE_MS ?? String(7 * 24 * 3600 * 1000))
  const cutoff = Date.now() - maxAgeMs
  return pendingPublished.filter((a) => a.publishedAt >= cutoff)
}

export function mergeAgentsWithPending<T extends { agentId: `0x${string}`; metadataUri: string; name: string }>(
  onChain: T[],
  pending: PendingRegistryAgent[],
): Array<T | (PendingRegistryAgent & { pending: true })> {
  const onChainUris = new Set(onChain.map((a) => a.metadataUri.toLowerCase()))
  const onChainNames = new Set(onChain.map((a) => a.name.toLowerCase()))
  const stillPending = pending.filter(
    (p) =>
      !onChainUris.has(p.metadataUri.toLowerCase()) &&
      !onChainNames.has(p.name.toLowerCase()),
  )
  return [...onChain, ...stillPending.map((p) => ({ ...p, pending: true as const }))]
}
