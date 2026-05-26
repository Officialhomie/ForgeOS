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
import { Wallet, ExternalLink } from 'lucide-react'

export function StepOne_Connect() {
  const {
    isConnected,
    address,
    connectWallet,
    connectPending,
    connectError,
    phase,
    demo,
    skipDemoActivation,
    error,
    isForgeChain,
    chainId,
  } = useActivationContext()

  const busy = connectPending || phase === 'connecting'

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80 ring-forge-border/30">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-orange/15 text-forge-orange">
          <Wallet className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl text-forge-text">
          Connect your wallet
        </CardTitle>
        <CardDescription className="text-forge-text-muted">
          ForgeOS uses MetaMask Smart Accounts. Your wallet becomes the root of your
          agent permission system — no keys are ever shared with agents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && address ? (
          <div className="rounded-lg border border-forge-success/30 bg-forge-success/5 px-4 py-3">
            <p className="text-xs font-medium text-forge-success">Connected</p>
            <AddressDisplay address={address} className="mt-1" />
          </div>
        ) : (
          <div className="rounded-lg border border-forge-border-subtle bg-forge-bg/60 px-4 py-3 text-sm text-forge-text-muted">
            MetaMask not connected. Install{' '}
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-forge-orange hover:underline"
            >
              MetaMask
              <ExternalLink className="size-3" />
            </a>{' '}
            to continue.
          </div>
        )}

        {(connectError || error) && (
          <p className="text-sm text-forge-danger">
            {error ?? connectError?.message}
          </p>
        )}

        {isConnected && !isForgeChain && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Wrong network (chain {chainId}). Approve switching to Ethereum Sepolia
            (chain 11155111) in MetaMask.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {!isConnected && (
            <Button onClick={() => void connectWallet()} disabled={busy}>
              {busy ? 'Connecting…' : 'Connect MetaMask'}
            </Button>
          )}
          {demo && (
            <Button variant="outline" onClick={skipDemoActivation}>
              Skip to dashboard (demo)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
