/**
 * Chunked eth_getLogs helper for ForgeOSRegistry.
 *
 * Alchemy free tier allows only 10-block ranges and rate-limits burst traffic.
 * This module throttles requests, retries on 429, and caches agent lists briefly.
 */

import type { GetLogsReturnType, PublicClient } from 'viem'
import { parseAbiItem } from 'viem'

export const AGENT_REGISTERED_EVENT = parseAbiItem(
  'event AgentRegistered(bytes32 indexed agentId, address indexed creator, string name, string metadataUri)',
)

export type AgentRegisteredLog = GetLogsReturnType<typeof AGENT_REGISTERED_EVENT>[number]

// ─── CONFIG ───────────────────────────────────────────────────────────────────

export const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`) ??
  '0x4668B4Dd600FB4404783a9C73B6b4fcb71e78347'

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

export function resolveFromBlock(latestBlock: bigint, configuredFromBlock: bigint): bigint {
  const { blockRange, maxRequests } = getLogScanConfig()
  const boundedFromBlock =
    latestBlock > BigInt(blockRange * maxRequests)
      ? latestBlock - BigInt(blockRange * maxRequests) + 1n
      : 0n
  return configuredFromBlock > boundedFromBlock ? configuredFromBlock : boundedFromBlock
}

export interface FetchRegistryLogsOptions {
  fromBlock: bigint
  toBlock: bigint
  agentId?: `0x${string}`
  /** Scan newest blocks first (useful for install lookups). */
  reverse?: boolean
}

export async function fetchRegistryLogs(
  client: PublicClient,
  options: FetchRegistryLogsOptions,
): Promise<AgentRegisteredLog[]> {
  const { fromBlock, toBlock, agentId, reverse = false } = options
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
  return agentsCache.agents as T[]
}

export function setCachedAgents(agents: unknown[]) {
  agentsCache = { agents, fetchedAt: Date.now() }
}

export function clearAgentsCache() {
  agentsCache = null
}
