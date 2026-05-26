'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CONTRACTS } from '@/lib/contracts'
import { forgeChain } from '@/lib/wagmi/chains'
import { ONESHOT } from '@/lib/constants'
import { Coins, X } from 'lucide-react'

export function TopUpModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}) {
  const [amount, setAmount] = useState('25')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  async function handleFund() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/relay/fund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId: ONESHOT.CHAIN_ID,
          amountUsdc: amount,
          treasuryAddress: CONTRACTS.agentTreasury,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Fund failed')
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fund failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
    >
      <Card className="relative w-full max-w-md border-forge-border bg-forge-surface">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-forge-text-muted hover:bg-forge-elevated"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-forge-orange/15 text-forge-orange">
            <Coins className="size-5" />
          </div>
          <CardTitle id="topup-title">Top up treasury</CardTitle>
          <CardDescription>
            Add USDC on Ethereum Sepolia (chain {forgeChain.id}) via 1Shot relay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-forge-info/30 bg-forge-info/10 px-3 py-2 text-xs text-forge-text-muted">
            Use Ethereum Sepolia USDC from a faucet (sepolia.etherscan.io), then fund AgentTreasury.
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-forge-text-muted">USDC amount</span>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-forge-border bg-forge-bg px-3 py-2 text-sm outline-none focus:border-forge-orange"
            />
          </label>
          {error && <p className="text-sm text-forge-danger">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleFund()} disabled={busy}>
              {busy ? 'Submitting…' : 'Add funds'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
