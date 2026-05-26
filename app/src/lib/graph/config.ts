export function getSubgraphUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUBGRAPH_URL
  if (!url || url.trim() === '') return null
  return url.trim()
}

export function isGraphEnabled(): boolean {
  return getSubgraphUrl() !== null
}

export const GRAPH_POLL_MS = 15_000
