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
    requestPermissionsDemo,
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
          Sign master delegation
        </CardTitle>
        <CardDescription>
          One ERC-7715 permission request via MetaMask Flask. Caveats are enforced
          on-chain by the OS kernel on Ethereum Sepolia.
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
            Switch to Ethereum Sepolia (chain 11155111) in MetaMask. ERC-7715
            permissions require Ethereum Sepolia — MetaMask Flask does not support
            this on Base Sepolia.
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
              <dd className="flex flex-col items-end gap-0.5">
                <span className="text-xs font-medium text-forge-orange">OSKernel</span>
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

        <WalletProviderNotice />

        {erc7715Ready && !erc7715RpcAvailable && (
          <div className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2.5 text-xs text-forge-warning">
            <p className="font-semibold">ERC-7715 RPC not available in this Flask build</p>
            <p className="mt-1">
              Flask is detected, but{' '}
              <span className="font-mono">wallet_requestExecutionPermissions</span> is not
              exposed. Use demo delegation below to continue activation, or try an older
              Flask build with ERC-7715 enabled.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-300">
          <span className="font-semibold">Requires MetaMask Flask.</span>{' '}
          Standard MetaMask does not support{' '}
          <span className="font-mono">wallet_requestExecutionPermissions</span> (ERC-7715).
          Install Flask at{' '}
          <a
            href="https://metamask.io/flask/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-200"
          >
            metamask.io/flask
          </a>
          {' '}and switch to Sepolia. For judges: run in demo mode.
        </div>

        {error && phase === 'error' && (
          <p className="rounded-lg bg-forge-danger/10 px-3 py-2 text-xs text-forge-danger">{error}</p>
        )}

        <p className="text-xs text-forge-text-subtle">
          Revoke anytime from the dashboard — one click kills all agents atomically.
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
            {busy ? 'Waiting for MetaMask…' : 'Request ERC-7715 permissions'}
          </Button>
          {erc7715Ready && !erc7715RpcAvailable && (
            <Button
              variant="outline"
              disabled={gated || busy || walletDisconnected}
              onClick={() => void requestPermissionsDemo()}
            >
              Continue with demo delegation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
