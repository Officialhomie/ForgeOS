'use client'

import { useState } from 'react'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { parseUnits } from 'viem'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ACTIVATION_CHAIN_ID } from '@/types/activation'
import { ensureForgeChain } from '@/lib/wagmi/ensure-forge-chain'
import {
  formatWalletFundingError,
  fundTreasuryFromWallet,
} from '@/lib/treasury/fund-from-wallet'
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
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()

  if (!open) return null

  async function handleFund() {
    setBusy(true)
    setError(null)
    try {
      if (!isConnected || !address) {
        throw new Error('Connect your wallet before adding funds')
      }
      if (!walletClient) {
        throw new Error('MetaMask wallet client unavailable')
      }
      if (chainId !== ACTIVATION_CHAIN_ID) {
        await ensureForgeChain(switchChainAsync)
      }

      const amountRaw = parseUnits(amount, 6)
      await fundTreasuryFromWallet({
        walletClient,
        funder: address,
        amountRaw,
        amountUsdcLabel: amount,
      })

      onSuccess?.()
      onClose()
    } catch (e) {
      setError(formatWalletFundingError(e))
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
          <CardTitle id="topup-title">Add funds</CardTitle>
          <CardDescription>
            Move USDC from your wallet into your agents&apos; spending pool. MetaMask will ask
            you to approve USDC, then confirm the deposit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-forge-info/30 bg-forge-info/10 px-3 py-2 text-xs text-forge-text-muted">
            On Sepolia testnet, you need Circle test USDC in your wallet first. This uses the
            same flow as activation step 4 — not a server relay.
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
            <Button onClick={() => void handleFund()} disabled={busy || !isConnected}>
              {busy ? 'Confirm in MetaMask…' : 'Add funds'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
