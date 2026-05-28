/**
 * Turnkey-backed signer for the Venice agent wallet.
 *
 * The secp256k1 Ethereum private key never leaves Turnkey's HSM.
 * What lives in env vars is an Ed25519 API keypair — a credential that can
 * only invoke Turnkey's signing API, not export or drain the wallet directly.
 *
 * If TURNKEY_API_PRIVATE_KEY is leaked:
 *   → Revoke it in the Turnkey dashboard, generate a new one.
 *   → Wallet address unchanged, funds safe.
 *
 * Env vars required (all server-side, never NEXT_PUBLIC_*):
 *   TURNKEY_API_PUBLIC_KEY   — Ed25519 public key (non-sensitive)
 *   TURNKEY_API_PRIVATE_KEY  — Ed25519 private key (sensitive API credential, NOT the wallet key)
 *   TURNKEY_ORGANIZATION_ID  — UUID of your Turnkey org
 *   TURNKEY_PRIVATE_KEY_ID   — UUID of the wallet key inside Turnkey (not the key itself)
 *   TURNKEY_WALLET_ADDRESS   — Ethereum address of the wallet (public info)
 */

import type { Address } from 'viem'

export function hasTurnkeyConfig(): boolean {
  return !!(
    process.env.TURNKEY_API_PUBLIC_KEY &&
    process.env.TURNKEY_API_PRIVATE_KEY &&
    process.env.TURNKEY_ORGANIZATION_ID &&
    process.env.TURNKEY_PRIVATE_KEY_ID &&
    process.env.TURNKEY_WALLET_ADDRESS
  )
}

export async function createTurnkeyAccount(ethereumAddress: Address) {
  // Dynamic imports keep @turnkey/* out of the default bundle when not configured.
  const [{ Turnkey }, { createAccount }] = await Promise.all([
    import('@turnkey/sdk-server'),
    import('@turnkey/viem'),
  ])

  const turnkey = new Turnkey({
    apiBaseUrl: 'https://api.turnkey.com',
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  })

  return createAccount({
    client: turnkey.apiClient(),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    signWith: process.env.TURNKEY_PRIVATE_KEY_ID!,
    ethereumAddress,
  })
}
