'use client'

import { useRouter } from 'next/navigation'
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
import { forgeChain } from '@/lib/wagmi/chains'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import { Coins, Network } from 'lucide-react'
import { useOsStore } from '@/stores/os.store'

export function StepFour_Confirm() {
  const router = useRouter()
  const osStatus = useOsStore((s) => s.osStatus)
  const {
    canProceed,
    fundTreasury,
    fundAmountUsdc,
    setFundAmountUsdc,
    phase,
    isForgeChain,
    fundTxHash,
    error,
  } = useActivationContext()

  const gated = !canProceed('fund')
  const busy = phase === 'funding'
  const done = osStatus === 'active'

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-success/15 text-forge-success">
          <Coins className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Fund agent treasury
        </CardTitle>
        <CardDescription>
          Kernel, registry, and treasury all live on Ethereum Sepolia (chain{' '}
          {forgeChain.id}). USDC here funds agent operations and test x402 flows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> OS kernel
            </p>
            <AddressDisplay address={CONTRACTS.osKernel} className="mt-1" />
            <p className="mt-1 text-[10px] text-forge-text-subtle">
              Chain {ACTIVATION_CHAIN_ID}
            </p>
          </div>
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> Agent treasury
            </p>
            <AddressDisplay address={CONTRACTS.agentTreasury} className="mt-1" />
            <p className="mt-1 text-[10px] text-forge-text-subtle">
              Chain {ACTIVATION_CHAIN_ID}
            </p>
          </div>
        </div>

        {!isForgeChain && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Switch to Ethereum Sepolia (chain 11155111) in MetaMask to fund the treasury with USDC.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-forge-text-muted">USDC amount</span>
          <input
            type="number"
            min="1"
            step="1"
            value={fundAmountUsdc}
            onChange={(e) => setFundAmountUsdc(e.target.value)}
            disabled={gated || busy || done}
            className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text"
          />
        </label>

        {error && (
          <p className="text-sm text-forge-danger" role="alert">
            {error}
          </p>
        )}

        {fundTxHash && (
          <p className="text-xs text-forge-text-muted">
            Fund tx: <span className="font-mono">{fundTxHash.slice(0, 18)}…</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            disabled={gated || busy || done}
            onClick={() => void fundTreasury()}
          >
            {busy ? 'Funding…' : done ? 'Funded' : 'Fund treasury'}
          </Button>
          {done && (
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Open dashboard
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
