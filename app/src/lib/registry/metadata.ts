/**
 * Resolve agent metadata stored at registry `endpoint` (ipfs://, data:, or gateway URL).
 */

import { ipfsUriToGatewayUrl } from '@/lib/ipfs/client'

function metadataFetchUrl(uri: string): string | null {
  if (uri.startsWith('data:application/json;base64,')) return null
  if (uri.startsWith('ipfs://')) {
    return ipfsUriToGatewayUrl(uri) ?? `https://ipfs.io/ipfs/${uri.slice(7)}`
  }
  if (/^https?:\/\//i.test(uri)) return uri
  return null
}

export async function resolveRegistryMetadata(uri: string): Promise<object | null> {
  try {
    if (uri.startsWith('data:application/json;base64,')) {
      const b64 = uri.replace('data:application/json;base64,', '')
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as object
    }
    const url = metadataFetchUrl(uri)
    if (!url) return null
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return (await res.json()) as object
  } catch {
    return null
  }
}
