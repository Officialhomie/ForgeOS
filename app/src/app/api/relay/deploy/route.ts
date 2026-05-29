import { NextResponse } from 'next/server'

/**
 * Legacy deploy relay hook. ForgeOS activation uses MetaMask Stateless7702 (EOA = smart account),
 * so step 2 completes client-side after address prediction — before ERC-7715 permissions exist.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Gasless deploy requires ERC-7710 permissions first. On Stateless7702, activation step 2 uses your wallet address directly — no relay deploy needed.',
      code: 'DEPLOY_NEEDS_PERMISSIONS',
    },
    { status: 400 },
  )
}
