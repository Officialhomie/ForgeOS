/**
 * POST /api/delegations/bundle — persist signed delegation chain for cron.
 * GET  /api/delegations/bundle?address=0x... — load bundle (cron / server).
 */

import { NextResponse } from 'next/server'
import {
  getDelegationBundle,
  setDelegationBundle,
} from '@/lib/delegation/bundle-store'
import { validateBundleForA2A } from '@/lib/delegation/proof-bundle'
import type { Address, Delegation } from '@/types'

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('Authorization') === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { smartAccountAddress: Address; delegations: Delegation[] }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { smartAccountAddress, delegations } = body
  if (!smartAccountAddress || !delegations?.length) {
    return NextResponse.json(
      { success: false, error: 'smartAccountAddress and delegations required' },
      { status: 400 },
    )
  }

  const root = delegations.find((d) => d.hop === 'root') ?? delegations[0]
  const sub = delegations.find((d) => d.hop === 'sub') ?? null
  const re = delegations.find((d) => d.hop === 'redelegation') ?? null
  const errors = validateBundleForA2A(root, sub, re)
  if (errors.length > 0) {
    return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 422 })
  }

  setDelegationBundle(smartAccountAddress, delegations)
  return NextResponse.json({ success: true, count: delegations.length })
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const address = new URL(request.url).searchParams.get('address') as Address | null
  if (!address) {
    return NextResponse.json({ success: false, error: 'address query required' }, { status: 400 })
  }

  const delegations = getDelegationBundle(address)
  if (!delegations) {
    return NextResponse.json({ success: false, error: 'No bundle for address' }, { status: 404 })
  }

  return NextResponse.json({ success: true, delegations })
}
