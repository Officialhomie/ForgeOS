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
import { base } from '@/lib/wagmi/chains'
import { ACTIVATION_CHAIN_SEPOLIA } from '@/types/activation'
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
    isBase,
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
          Sepolia hosts your kernel and delegations. Base (chain {base.id}) holds USDC
          for Venice x402 inference and agent micropayments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> Sepolia kernel
            </p>
            <AddressDisplay address={CONTRACTS.osKernel} className="mt-1" />
            <p className="mt-1 text-[10px] text-forge-text-subtle">
              Chain {ACTIVATION_CHAIN_SEPOLIA}
            </p>
          </div>
          <div className="rounded-lg border border-forge-border-subtle p-3">
            <p className="flex items-center gap-1 text-xs text-forge-text-muted">
              <Network className="size-3" /> Base treasury
            </p>
            <AddressDisplay address={CONTRACTS.agentTreasury} className="mt-1" />
            <p className="mt-1 text-[10px] text-forge-text-subtle">
              Chain {base.id}
            </p>
          </div>
        </div>

        {!isBase && (
          <p className="rounded-lg border border-forge-warning/40 bg-forge-warning/10 px-3 py-2 text-xs text-forge-warning">
            Switch to Base in MetaMask to fund the treasury with USDC.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-forge-text-muted">USDC amount (Base)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={fundAmountUsdc}
            onChange={(e) => setFundAmountUsdc(e.target.value)}
            className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm text-forge-text outline-none focus:border-forge-orange"
          />
        </label>

        {fundTxHash && (
          <p className="font-mono text-xs text-forge-text-subtle">
            Fund tx: {fundTxHash.slice(0, 14)}…
          </p>
        )}

        {error && phase === 'error' && (
          <p className="text-sm text-forge-danger">{error}</p>
        )}

        {done ? (
          <div className="space-y-3 rounded-lg border border-forge-success/40 bg-forge-success/10 p-4">
            <p className="text-lg font-semibold text-forge-success">ForgeOS is active</p>
            <p className="text-sm text-forge-text-muted">
              Root delegation registered. Agent fleet and treasury are ready.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Open dashboard
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => void fundTreasury()}
            disabled={gated || busy}
          >
            {busy ? 'Funding via 1Shot…' : 'Fund treasury'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
