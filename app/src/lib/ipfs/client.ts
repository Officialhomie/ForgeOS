/**
 * IPFS Client
 *
 * Uploads JSON metadata to IPFS.
 * Uses Pinata if PINATA_JWT is set, falls back to inline base64 encoding.
 *
 * Track evidence:
 *  - Best Agent: agent metadata stored on IPFS, referenced on-chain
 */

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AgentMetadata {
  name: string
  description: string
  category: string
  version: string
  promptTemplate: string
  caveatTemplate: object
  agentAddress: string
  createdAt: number
  creator?: string
}

// ─── PINATA ───────────────────────────────────────────────────────────────────

async function pinViaPinata(metadata: object): Promise<string> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) throw new Error('PINATA_JWT not configured')

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `forgeos-agent-${Date.now()}.json` },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata error: ${err}`)
  }

  const data = (await res.json()) as { IpfsHash: string }
  return `ipfs://${data.IpfsHash}`
}

// ─── INLINE FALLBACK ──────────────────────────────────────────────────────────

/**
 * Encodes metadata as a data URI when IPFS pinning is unavailable.
 * This is a hackathon fallback — production should always pin to IPFS.
 */
function encodeInline(metadata: object): string {
  const json = JSON.stringify(metadata)
  const b64 = Buffer.from(json).toString('base64')
  return `data:application/json;base64,${b64}`
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Pin JSON metadata and return the URI.
 * Returns ipfs://Qm... if Pinata is configured, else a data: URI.
 */
export async function pinJson(metadata: object): Promise<string> {
  if (process.env.PINATA_JWT) {
    return pinViaPinata(metadata)
  }
  // Fallback: inline base64 (works for hackathon, not production)
  return encodeInline(metadata)
}
