/**
 * GET /api/delegations/audit — delegation health check.
 */

import { NextResponse } from 'next/server'
import { isValidProof, validateBundleForA2A } from '@/lib/delegation/proof-bundle'
import type { Delegation } from '@/types'

export async function GET(request: Request) {
  let delegations: Delegation[] = []
  try {
    const body = (await request.json().catch(() => null)) as { delegations?: Delegation[] } | null
    delegations = body?.delegations ?? []
  } catch {
    delegations = []
  }

  const fromQuery = request.headers.get('content-type')?.includes('json')
  if (!delegations.length && fromQuery) {
    return NextResponse.json({ success: false, error: 'POST delegations[] for audit' }, { status: 400 })
  }

  const issues: string[] = []
  for (const d of delegations) {
    if (!isValidProof(d)) {
      issues.push(`${d.hop} ${d.hash.slice(0, 10)}… unsigned or placeholder signature`)
    }
    const expiry = d.caveats.find((c) => c.enforcerName.includes('Timestamp'))
    if (expiry?.decodedTerms && typeof expiry.decodedTerms === 'object') {
      const exp = (expiry.decodedTerms as { expiry?: number }).expiry
      if (exp && exp < Math.floor(Date.now() / 1000) + 30 * 86400) {
        issues.push(`${d.hop} expires within 30 days`)
      }
    }
  }

  const root = delegations.find((d) => d.hop === 'root')
  const sub = delegations.find((d) => d.hop === 'sub')
  const re = delegations.find((d) => d.hop === 'redelegation')
  issues.push(...validateBundleForA2A(root ?? null, sub ?? null, re ?? null))

  return NextResponse.json({
    success: true,
    healthy: issues.length === 0,
    issues,
    count: delegations.length,
  })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { delegations: Delegation[] }
  const url = new URL(request.url)
  const req = new Request(url, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  })
  void req
  const issues: string[] = []
  for (const d of body.delegations ?? []) {
    if (!isValidProof(d)) {
      issues.push(`${d.hop} ${d.hash.slice(0, 10)}… unsigned`)
    }
  }
  const root = body.delegations?.find((d) => d.hop === 'root')
  const sub = body.delegations?.find((d) => d.hop === 'sub')
  const re = body.delegations?.find((d) => d.hop === 'redelegation')
  issues.push(...validateBundleForA2A(root ?? null, sub ?? null, re ?? null))

  return NextResponse.json({
    success: true,
    healthy: issues.length === 0,
    issues,
  })
}
