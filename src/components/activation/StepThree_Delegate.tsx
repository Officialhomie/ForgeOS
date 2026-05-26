'use client'

import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { useActivationContext } from '@/providers/ActivationProvider'
import { CONTRACTS } from '@/lib/contracts'
import { DEFAULT_POLICY_PREVIEW } from '@/types/activation'
import { KeyRound, Shield } from 'lucide-react'

export function StepThree_Delegate() {
  const { canProceed, requestPermissions, phase, error, isSepolia } =
    useActivationContext()

  const gated = !canProceed('permissions')
  const busy = phase === 'requesting_permissions'

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-gold/15 text-forge-gold">
          <KeyRound className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Sign master delegation
        </CardTitle>
        <CardDescription>
          One ERC-7715 permission request (Sepolia Snaps). MetaMask shows exactly what
          you approve — caveats are enforced on-chain by the OS kernel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSepolia && (
          <p className="rounded-lg border border-forge-danger/40 bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">
            ERC-7715 is only available on Sepolia. Switch network and retry.
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-forge-border-subtle bg-forge-bg/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-forge-text-muted">
            <Shield className="size-3.5 text-forge-orange" />
            Delegation preview
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Delegate</dt>
              <dd>
                <AddressDisplay address={CONTRACTS.osKernel} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Authority</dt>
              <dd className="font-mono text-forge-mono">ROOT</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Monthly cap</dt>
              <dd>${DEFAULT_POLICY_PREVIEW.monthlySpendCapUsdc} USDC</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Expires</dt>
              <dd>{DEFAULT_POLICY_PREVIEW.expiryLabel}</dd>
            </div>
          </dl>
          <ul className="mt-2 space-y-1 border-t border-forge-border-subtle pt-3 text-xs text-forge-text-subtle">
            {DEFAULT_POLICY_PREVIEW.caveats.map((c) => (
              <li key={c} className="font-mono">
                · {c}
              </li>
            ))}
          </ul>
        </div>

        {error && phase === 'error' && (
          <p className="text-sm text-forge-danger">{error}</p>
        )}

        <p className="text-xs text-forge-text-subtle">
          Revoke anytime from the dashboard — one click kills all agents atomically.
        </p>

        <Button
          onClick={() => void requestPermissions()}
          disabled={gated || busy}
        >
          {busy ? 'Waiting for MetaMask…' : 'Request ERC-7715 permissions'}
        </Button>
      </CardContent>
    </Card>
  )
}
