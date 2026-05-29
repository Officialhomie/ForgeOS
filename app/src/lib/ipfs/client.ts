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

export type PinJsonSource = 'pinata' | 'inline'

export interface PinJsonResult {
  uri: string
  source: PinJsonSource
  /** Set when Pinata was configured but pinning failed (fallback used). */
  pinataError?: string
}

// ─── PINATA ───────────────────────────────────────────────────────────────────

const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'
const PINATA_TIMEOUT_MS = 45_000
const PINATA_MAX_ATTEMPTS = 3

function normalizePinataJwt(raw: string): string {
  let jwt = raw.trim()
  if (jwt.toLowerCase().startsWith('bearer ')) {
    jwt = jwt.slice(7).trim()
  }
  if (
    (jwt.startsWith('"') && jwt.endsWith('"')) ||
    (jwt.startsWith("'") && jwt.endsWith("'"))
  ) {
    jwt = jwt.slice(1, -1).trim()
  }
  return jwt
}

function formatFetchError(e: unknown): string {
  if (e instanceof Error) {
    const cause =
      e.cause instanceof Error
        ? e.cause.message
        : e.cause != null
          ? String(e.cause)
          : ''
    return cause ? `${e.message} (${cause})` : e.message
  }
  return String(e)
}

async function pinViaPinata(metadata: object, jwt: string): Promise<string> {
  let lastError = 'Pinata request failed'

  for (let attempt = 1; attempt <= PINATA_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(PINATA_PIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          pinataContent: metadata,
          pinataMetadata: { name: `forgeos-agent-${Date.now()}.json` },
        }),
        signal: AbortSignal.timeout(PINATA_TIMEOUT_MS),
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Pinata HTTP ${res.status}: ${err.slice(0, 200)}`)
      }

      const data = (await res.json()) as { IpfsHash?: string; cid?: string }
      const hash = data.IpfsHash ?? data.cid
      if (!hash) {
        throw new Error('Pinata response missing IpfsHash')
      }
      return `ipfs://${hash}`
    } catch (e) {
      lastError = formatFetchError(e)
      const retryable =
        /fetch failed|ECONNRESET|ETIMEDOUT|timeout|network|socket/i.test(lastError)
      if (!retryable || attempt === PINATA_MAX_ATTEMPTS) {
        throw new Error(lastError)
      }
      await new Promise((r) => setTimeout(r, attempt * 400))
    }
  }

  throw new Error(lastError)
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

export function ipfsUriToGatewayUrl(uri: string): string | null {
  if (!uri.startsWith('ipfs://')) return null
  const cid = uri.slice(7)
  return `https://gateway.pinata.cloud/ipfs/${cid}`
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Pin JSON metadata and return the URI.
 * Returns ipfs://Qm... if Pinata succeeds, else a data: URI.
 */
export async function pinJson(metadata: object): Promise<PinJsonResult> {
  const jwt = process.env.PINATA_JWT
    ? normalizePinataJwt(process.env.PINATA_JWT)
    : ''

  if (jwt) {
    try {
      const uri = await pinViaPinata(metadata, jwt)
      return { uri, source: 'pinata' }
    } catch (e) {
      const msg = formatFetchError(e)
      console.warn('[ipfs] Pinata pin failed, using inline metadata URI:', msg)
      return {
        uri: encodeInline(metadata),
        source: 'inline',
        pinataError: msg,
      }
    }
  }

  return { uri: encodeInline(metadata), source: 'inline' }
}
