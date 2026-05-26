/**
 * Ed25519 webhook signature verification for 1Shot relay callbacks.
 *
 * 1Shot signs the raw request body with an Ed25519 key.
 * The public key is provided as ONESHOT_WEBHOOK_SECRET (hex, 32 bytes).
 *
 * Header: X-1Shot-Signature: <hex-encoded signature>
 */

import { createVerify } from 'crypto'

// DER prefix for an Ed25519 SubjectPublicKeyInfo (SPKI) structure.
// Allows Node.js crypto to accept raw 32-byte Ed25519 public keys.
const ED25519_DER_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/**
 * Wrap a raw 32-byte Ed25519 public key in DER/SPKI format.
 */
function toDerPublicKey(rawHex: string): Buffer {
  const raw = Buffer.from(rawHex.replace(/^0x/, ''), 'hex')
  if (raw.length !== 32) {
    throw new Error(`Ed25519 public key must be 32 bytes, got ${raw.length}`)
  }
  return Buffer.concat([ED25519_DER_PREFIX, raw])
}

/**
 * Verify a 1Shot webhook Ed25519 signature.
 *
 * @param payload   Raw request body as Buffer
 * @param signature Hex-encoded Ed25519 signature from X-1Shot-Signature header
 * @param publicKey Hex-encoded 32-byte Ed25519 public key (ONESHOT_WEBHOOK_SECRET)
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: Buffer,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const derKey = toDerPublicKey(publicKey)
    const sigBytes = Buffer.from(signature.replace(/^0x/, ''), 'hex')

    const verify = createVerify('ed25519')
    verify.update(payload)
    return verify.verify({ key: derKey, format: 'der', type: 'spki' }, sigBytes)
  } catch {
    return false
  }
}

/**
 * Extract the 1Shot signature from request headers.
 * 1Shot may use X-1Shot-Signature or X-Webhook-Signature.
 */
export function extractSignature(headers: Headers): string | null {
  return (
    headers.get('x-1shot-signature') ??
    headers.get('x-webhook-signature') ??
    null
  )
}
