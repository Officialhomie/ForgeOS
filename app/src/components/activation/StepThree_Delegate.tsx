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
import { KeyRound, Shield, Wallet } from 'lucide-react'
import { WalletProviderNotice } from '@/components/activation/WalletProviderNotice'
import { useWalletRuntimeDiagnostics } from '@/hooks/useWalletRuntimeDiagnostics'
import { useErc7715Support } from '@/hooks/useErc7715Support'

export function StepThree_Delegate() {
  const {
    canProceed,
    requestPermissions,
    phase,
    error,
    isSepolia,
    isConnected,
    goBack,
  } = useActivationContext()

  const gated = !canProceed('permissions')
  const busy = phase === 'requesting_permissions'
  const walletDisconnected = !isConnected
  const { conflict: walletConflict, ready: walletDiagReady } =
    useWalletRuntimeDiagnostics()
  const { ready: erc7715Ready, rpcAvailable: erc7715RpcAvailable } =
    useErc7715Support()

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-gold/15 text-forge-gold">
          <KeyRound className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Set agent permissions
        </CardTitle>
        <CardDescription>
          Choose what your agents are allowed to do. You stay in control — agents can only
          act within the limits you approve here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {walletDisconnected && (
          <div className="rounded-lg border border-forge-danger/40 bg-forge-danger/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-forge-danger">
              <Wallet className="size-4 shrink-0" />
              Wallet disconnected
            </div>
            <p className="mt-1 text-xs text-forge-danger/80">
              Your wallet is no longer connected. Go back to Step 1 to reconnect
              before signing the delegation.
            </p>
            <button
              onClick={goBack}
              className="mt-2 text-xs font-medium text-forge-danger underline underline-offset-2 hover:text-forge-danger/80"
            >
              ← Go back and reconnect
            </button>
          </div>
        )}

        {!isSepolia && !walletDisconnected && (
          <p className="rounded-lg border border-forge-danger/40 bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">
            Please switch to Ethereum Sepolia in MetaMask before continuing. Agent permissions are only supported on Sepolia.
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-forge-border-subtle bg-forge-bg/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-forge-text-muted">
            <Shield className="size-3.5 text-forge-orange" />
            What you are approving
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Managed by</dt>
              <dd className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-medium text-forge-orange">ForgeOS</span>
                <AddressDisplay address={CONTRACTS.osKernel} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-forge-text-muted">Access level</dt>
              <dd className="text-forge-text">Full (you can revoke anytime)</dd>
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

        <WalletProviderNotice />

        {erc7715Ready && !erc7715RpcAvailable && (
          <div className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2.5 text-xs text-forge-warning">
            <p className="font-semibold">Your MetaMask Flask version is out of date</p>
            <p className="mt-1">
              Flask was detected, but agent permissions are not available in this version. Please update MetaMask Flask and try again.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-300">
          <span className="font-semibold">Requires MetaMask Flask (developer edition).</span>{' '}
          The standard MetaMask app does not yet support agent permissions.
          Install Flask at{' '}
          <a
            href="https://metamask.io/flask/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200"
          >
            metamask.io/flask
          </a>
          {' '}and switch to Sepolia to continue.
        </div>

        {error && phase === 'error' && (
          <p className="rounded-lg bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">{error}</p>
        )}

        <p className="text-xs text-forge-text-subtle">
          You can revoke this from the dashboard at any time — one click stops all your agents immediately.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => void requestPermissions()}
            disabled={
              gated ||
              busy ||
              walletDisconnected ||
              (walletDiagReady && walletConflict) ||
              (erc7715Ready && !erc7715RpcAvailable)
            }
          >
            {busy ? 'Waiting for MetaMask…' : 'Approve agent permissions'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
