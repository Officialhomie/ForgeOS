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
import { Coins, Network } from 'lucide-react'
import { useOsStore } from '@/stores/os.store'

export function StepFour_Confirm() {
  const router = useRouter()
  const osStatus = useOsStore((s) => s.osStatus)
  const {
    canProceed,
    fundTreasury,
    cancelFunding,
    resetActivation,
    ensureForgeNetwork,
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
  const errored = phase === 'error'

  return (
    <Card className="border-forge-border-subtle bg-forge-surface/80">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-success/15 text-forge-success">
          <Coins className="size-5" />
        </div>
        <CardTitle className="font-[family-name:var(--font-display)] text-xl">
          Add funds
        </CardTitle>
        <CardDescription>
          Your agents need a small balance to pay for the actions they take. You set the
          amount — they can never spend more than you put in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> ForgeOS system
            </p>
            <AddressDisplay address={CONTRACTS.osKernel} className="mt-1" />
          </div>
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> Your spending pool
            </p>
            <AddressDisplay address={CONTRACTS.agentTreasury} className="mt-1" />
          </div>
        </div>

        {!isForgeChain && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Please switch to Ethereum Sepolia in MetaMask before adding funds.
          </p>
        )}

        <p className="rounded-lg border border-forge-info/30 bg-forge-info/10 px-3 py-2 text-xs text-forge-text-muted">
          You'll need a small amount of Sepolia USDC in your wallet to continue. This is what your agents will spend when they take actions.
        </p>

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
            Transaction submitted — waiting for confirmation…
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="default"
            disabled={gated || busy || done || !isForgeChain}
            onClick={() => void fundTreasury()}
          >
            {busy ? 'Confirm in MetaMask…' : done ? 'Funds added' : 'Add funds'}
          </Button>
          {!isForgeChain && !busy && (
            <Button variant="outline" onClick={() => void ensureForgeNetwork()}>
              Switch network
            </Button>
          )}
          {busy && (
            <Button variant="outline" onClick={cancelFunding}>
              Cancel
            </Button>
          )}
          {done && (
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Open dashboard
            </Button>
          )}
          {(done || errored || busy) && (
            <Button variant="ghost" onClick={resetActivation}>
              Start over
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
