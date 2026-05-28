'use client'

import { useEffect } from 'react'
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
import { explorerTxUrl } from '@/lib/utils'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import { Cpu, Zap } from 'lucide-react'
import Link from 'next/link'

export function StepTwo_SmartAccount() {
  const {
    canProceed,
    deploySmartAccount,
    loadPredictedAddress,
    smartAccountAddress,
    deployTxHash,
    oneShotTaskId,
    phase,
    isSepolia,
    address,
    isConnected,
  } = useActivationContext()

  useEffect(() => {
    if (isConnected && address && canProceed('deploy')) {
      void loadPredictedAddress()
    }
  }, [isConnected, address, canProceed, loadPredictedAddress])

  const gated = !canProceed('deploy')
  const busy = phase === 'deploying'

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-info/15 text-forge-info">
          <Cpu className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Upgrade your account
        </CardTitle>
        <CardDescription>
          This adds smart capabilities to your wallet so your agents can act on your behalf.
          Your wallet stays yours — agents can only do what you allow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSepolia && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Please switch to Ethereum Sepolia in MetaMask before continuing.
          </p>
        )}

        {smartAccountAddress && (
          <div className="space-y-1">
            <p className="text-xs text-forge-text-muted">Your upgraded account address</p>
            <AddressDisplay address={smartAccountAddress} />
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-forge-border-subtle bg-forge-bg/50 p-3 text-xs text-forge-text-muted">
          <Zap className="mt-0.5 size-4 shrink-0 text-forge-orange" />
          <span>
            Managed by ForgeOS:{' '}
            <AddressDisplay address={CONTRACTS.osKernel} />
          </span>
        </div>

        {deployTxHash && (
          <Link
            href={explorerTxUrl(deployTxHash, ACTIVATION_CHAIN_ID)}
            target="_blank"
            className="text-xs text-forge-orange hover:underline"
          >
            See confirmation on blockchain →
          </Link>
        )}
        {oneShotTaskId && (
          <p className="font-mono text-xs text-forge-text-subtle">
            Processing…
          </p>
        )}

        <Button
          onClick={() => void deploySmartAccount()}
          disabled={gated || busy}
        >
          {busy ? 'Setting up your account…' : 'Continue'}
        </Button>
      </CardContent>
    </Card>
  )
}
