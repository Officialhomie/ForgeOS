/**
 * Client-side pending marketplace agents (shown until on-chain scan picks them up).
 */

import type { MarketplaceAgent } from '@/hooks/useMarketplace'

const STORAGE_KEY = 'forgeos-marketplace-pending'

export interface StoredPendingAgent {
  agentId: `0x${string}`
  creator: `0x${string}`
  name: string
  metadataUri: string
  metadata: MarketplaceAgent['metadata']
  taskId: string | null
  publishedAt: number
}

export function readPendingAgentsFromStorage(): StoredPendingAgent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredPendingAgent[]
    const maxAge = 7 * 24 * 3600 * 1000
    const cutoff = Date.now() - maxAge
    return parsed.filter((a) => a.publishedAt >= cutoff)
  } catch {
    return []
  }
}

export function savePendingAgentToStorage(agent: StoredPendingAgent) {
  const list = readPendingAgentsFromStorage().filter(
    (a) => a.metadataUri !== agent.metadataUri && a.name !== agent.name,
  )
  list.push(agent)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function mergeApiAgentsWithLocalPending(
  apiAgents: MarketplaceAgent[],
): MarketplaceAgent[] {
  const local = readPendingAgentsFromStorage()
  const uriSet = new Set(apiAgents.map((a) => a.metadataUri.toLowerCase()))
  const nameSet = new Set(apiAgents.map((a) => a.name.toLowerCase()))
  const extra = local
    .filter(
      (p) =>
        !uriSet.has(p.metadataUri.toLowerCase()) &&
        !nameSet.has(p.name.toLowerCase()),
    )
    .map(
      (p): MarketplaceAgent => ({
        agentId: p.agentId,
        creator: p.creator,
        name: p.name,
        metadataUri: p.metadataUri,
        metadata: p.metadata,
        blockNumber: null,
        txHash: null,
        pending: true,
      }),
    )
  return [...apiAgents, ...extra]
}

/** Pull metadata from IPFS and add to local pending list (e.g. after a prior launch). */
export async function recoverPendingFromIpfsUri(
  ipfsUri: string,
  opts?: { agentId?: `0x${string}`; creator?: `0x${string}` },
): Promise<void> {
  const normalized = ipfsUri.startsWith('ipfs://')
    ? ipfsUri
    : ipfsUri.startsWith('http')
      ? ipfsUri
      : `ipfs://${ipfsUri}`
  let metadata: MarketplaceAgent['metadata'] = null
  try {
    const url = normalized.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${normalized.slice(7)}`
      : normalized
    const res = await fetch(url)
    if (res.ok) {
      metadata = (await res.json()) as MarketplaceAgent['metadata']
    }
  } catch {
    // still save stub
  }
  const metaName =
    metadata && typeof metadata === 'object' && 'name' in metadata
      ? (metadata as { name?: string }).name
      : undefined
  const agentName = typeof metaName === 'string' && metaName ? metaName : 'Recovered agent'
  savePendingAgentToStorage({
    agentId:
      opts?.agentId ??
      (`0x${'0'.repeat(64)}` as `0x${string}`),
    creator:
      opts?.creator ??
      (`0x0000000000000000000000000000000000000000` as `0x${string}`),
    name: agentName,
    metadataUri: normalized.startsWith('ipfs://') ? normalized : `ipfs://${ipfsUri}`,
    metadata,
    taskId: null,
    publishedAt: Date.now(),
  })
}

export function prunePendingAgentsMatching(apiAgents: MarketplaceAgent[]) {
  const uriSet = new Set(apiAgents.map((a) => a.metadataUri.toLowerCase()))
  const nameSet = new Set(apiAgents.map((a) => a.name.toLowerCase()))
  const kept = readPendingAgentsFromStorage().filter(
    (p) =>
      !uriSet.has(p.metadataUri.toLowerCase()) &&
      !nameSet.has(p.name.toLowerCase()),
  )
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
}
