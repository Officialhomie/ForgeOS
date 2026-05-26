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
import { ACTIVATION_CHAIN_SEPOLIA } from '@/types/activation'
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
          Deploy smart account
        </CardTitle>
        <CardDescription>
          Your EOA upgrades to a MetaMask Smart Account (EIP-7702). Deployment is
          gasless via the 1Shot relayer on Sepolia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isSepolia && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Switch to Sepolia in MetaMask before deploying.
          </p>
        )}

        {smartAccountAddress && (
          <div className="space-y-1">
            <p className="text-xs text-forge-text-muted">Predicted smart account</p>
            <AddressDisplay address={smartAccountAddress} />
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-forge-border-subtle bg-forge-bg/50 p-3 text-xs text-forge-text-muted">
          <Zap className="mt-0.5 size-4 shrink-0 text-forge-orange" />
          <span>
            Kernel target:{' '}
            <AddressDisplay address={CONTRACTS.osKernel} />
          </span>
        </div>

        {deployTxHash && (
          <Link
            href={explorerTxUrl(deployTxHash, ACTIVATION_CHAIN_SEPOLIA)}
            target="_blank"
            className="text-xs text-forge-orange hover:underline"
          >
            View deploy transaction →
          </Link>
        )}
        {oneShotTaskId && (
          <p className="font-mono text-xs text-forge-text-subtle">
            1Shot task: {oneShotTaskId}
          </p>
        )}

        <Button
          onClick={() => void deploySmartAccount()}
          disabled={gated || busy}
        >
          {busy ? 'Deploying via 1Shot…' : 'Deploy account (gasless)'}
        </Button>
      </CardContent>
    </Card>
  )
}
