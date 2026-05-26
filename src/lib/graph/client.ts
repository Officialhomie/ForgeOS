import { getSubgraphUrl } from '@/lib/graph/config'

export class GraphQueryError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'GraphQueryError'
  }
}

export async function queryGraph<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = getSubgraphUrl()
  if (!url) {
    throw new GraphQueryError('Subgraph URL not configured (NEXT_PUBLIC_SUBGRAPH_URL)')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 0 },
  })

  const json = (await res.json()) as {
    data?: T
    errors?: { message: string }[]
  }

  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join('; ') ?? res.statusText
    throw new GraphQueryError(msg, json.errors)
  }

  if (!json.data) {
    throw new GraphQueryError('Empty subgraph response')
  }

  return json.data
}
